from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import json
from datetime import datetime, timezone, timedelta

from database import get_db
from models import Unit, Lesson, User, UserLevel, TestResult, FlashCard, VelocityLog, UserLessonCompletion
from schemas.lessons import (
    DashboardResponse, UnitResponse, LessonResponse,
    FlashCardResponse, SM2SubmitRequest, SM2SubmitResponse,
    VelocityLogRequest, VelocityStatsResponse, SeedCardsResponse,
    CompleteLessonRequest
)
from routers.auth import get_current_user
from utils.lesson_generator import generate_personalized_units
from utils.sm2 import sm2_next, compute_due_date, compute_hesitation_score, compute_quality_from_velocity

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# /progress  — real-time user performance analytics
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/progress")
def get_progress(year: int = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    now_utc = datetime.now(timezone.utc)

    # ── Walk CEFR_ORDER to find the user's current content level ──────
    CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
    content_level = "A1"
    for cefr in CEFR_ORDER:
        cefr_units = db.query(Unit).filter(Unit.level == cefr).all()
        if not cefr_units:
            break  # No curriculum beyond this point
        total_l = sum(
            db.query(Lesson).filter(Lesson.unit_id == u.id).count()
            for u in cefr_units
        )
        done_l = sum(
            db.query(UserLessonCompletion).join(Lesson).filter(
                Lesson.unit_id == u.id, UserLessonCompletion.user_id == user_id
            ).count()
            for u in cefr_units
        )
        content_level = cefr
        if done_l < total_l:
            break  # Still incomplete at this level — stay here

    # ── Lesson completion ────────────────────────────────────────────────────
    levels_to_fetch = CEFR_ORDER[:CEFR_ORDER.index(content_level) + 1]
    all_units = db.query(Unit).filter(Unit.level.in_(levels_to_fetch)).order_by(Unit.level, Unit.order).all()

    
    # Get all completed lesson IDs for this user
    completed_ids = {
        row[0] for row in db.query(UserLessonCompletion.lesson_id)
        .filter(UserLessonCompletion.user_id == user_id).all()
    }

    units_data = []
    total_lessons = 0
    total_completed = 0
    for u in all_units:
        lessons = db.query(Lesson).filter(Lesson.unit_id == u.id).all()
        done = sum(1 for l in lessons if l.id in completed_ids)
        total_lessons += len(lessons)
        total_completed += done
        units_data.append({
            "id": u.id, "title": u.title, "icon": u.icon, "order": u.order,
            "total": len(lessons), "completed": done,
            "pct": round(done / len(lessons) * 100) if lessons else 0
        })

    overall_pct = round(total_completed / total_lessons * 100) if total_lessons else 0

    # ── Accuracy from TestResults ─────────────────────────────────────────────
    all_scores = db.query(TestResult.score).filter(TestResult.user_id == user_id).all()
    accuracy = round(sum(r[0] for r in all_scores) / len(all_scores) * 100, 1) if all_scores else 0.0

    # ── Time studied (VelocityLog as proxy: each log = ~1 question answered) ──
    # Rough estimate: avg 30s per answered question
    MS_PER_QUESTION = 30_000

    def time_in_range(start: datetime, end: datetime) -> float:
        """Returns study hours based on velocity log count in range."""
        count = db.query(func.count(VelocityLog.id)).filter(
            VelocityLog.user_id == user_id,
            VelocityLog.created_at >= start,
            VelocityLog.created_at <= end
        ).scalar() or 0
        return round(count * MS_PER_QUESTION / 3_600_000, 2)  # hours

    today_start    = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start     = today_start - timedelta(days=today_start.weekday())
    month_start    = today_start.replace(day=1)
    # Get user account creation year or min year
    first_log = db.query(VelocityLog).filter(VelocityLog.user_id == user_id).order_by(VelocityLog.created_at.asc()).first()
    first_year = first_log.created_at.year if first_log and first_log.created_at else now_utc.year
    first_year = min(first_year, now_utc.year)
    
    target_year = year if year else now_utc.year
    year_start_date = datetime(target_year, 1, 1, tzinfo=timezone.utc)
    
    if target_year == now_utc.year:
        num_days = (today_start - year_start_date).days + 1
    else:
        year_end_date = datetime(target_year, 12, 31, tzinfo=timezone.utc)
        num_days = (year_end_date - year_start_date).days + 1

    time_today   = time_in_range(today_start, now_utc)
    time_week    = time_in_range(week_start, now_utc)
    time_month   = time_in_range(month_start, now_utc)
    time_year    = time_in_range(year_start_date, now_utc if target_year == now_utc.year else year_start_date.replace(month=12, day=31, hour=23, minute=59, second=59))
    time_total   = time_in_range(datetime(2000, 1, 1, tzinfo=timezone.utc), now_utc)

    # ── Daily activity heatmap (full year) ─────────────────────────────────
    from sqlalchemy.sql import cast
    from sqlalchemy import Date
    
    # Simple approach: fetch all created_at dates for the year in python to group
    logs = db.query(VelocityLog.created_at).filter(
        VelocityLog.user_id == user_id,
        VelocityLog.created_at >= year_start_date,
        VelocityLog.created_at < year_start_date + timedelta(days=num_days + 1)
    ).all()
    
    log_dict = {}
    for (d,) in logs:
        if d:
            ds = d.strftime("%Y-%m-%d")
            log_dict[ds] = log_dict.get(ds, 0) + 1
            
    heatmap = []
    for i in range(num_days):
        day = year_start_date + timedelta(days=i)
        ds = day.strftime("%Y-%m-%d")
        count = log_dict.get(ds, 0)
        heatmap.append({
            "date": ds,
            "day": day.strftime("%a"),
            "count": count,
            "level": 0 if count == 0 else (1 if count < 5 else (2 if count < 15 else 3))
        })

    # ── Skill breakdown from lesson content_type completion ───────────────────
    skill_map = {"theory": "grammar", "quiz": "vocabulary", "speaking": "speaking", "listening": "listening"}
    skill_scores: dict = {"speaking": [], "vocabulary": [], "grammar": [], "listening": []}

    completed_lessons = db.query(Lesson).join(UserLessonCompletion).join(Unit).filter(
        Unit.level == content_level, UserLessonCompletion.user_id == user_id
    ).all()


    for l in completed_lessons:
        skill = skill_map.get(l.content_type, "vocabulary")
        # Pull accuracy scores for this lesson from TestResults
        scores = db.query(TestResult.score).filter(
            TestResult.user_id == user_id, TestResult.question_id == l.id
        ).all()
        if scores:
            skill_scores[skill].extend(r[0] for r in scores)
        else:
            skill_scores[skill].append(0.75)  # default 75% if no explicit record

    def avg_pct(vals): return round(sum(vals) / len(vals) * 100) if vals else 0

    skills = {
        "speaking":   avg_pct(skill_scores["speaking"])   or 0,
        "vocabulary": avg_pct(skill_scores["vocabulary"]) or 0,
        "grammar":    avg_pct(skill_scores["grammar"])    or 0,
        "listening":  avg_pct(skill_scores["listening"])  or 0,
    }

    # ── Words known estimate ──────────────────────────────────────────────────
    base_words = {"A1": 0, "A2": 500, "B1": 1500, "B2": 3000, "C1": 5000, "C2": 10000}.get(content_level, 0)
    words_known = base_words + (total_completed * 15)

    # ── Due cards ─────────────────────────────────────────────────────────────
    due_count = db.query(FlashCard).filter(
        FlashCard.user_id == user_id, FlashCard.due_date <= now_utc
    ).count()

    # ── Streak ───────────────────────────────────────────────────────────────
    streak = current_user.current_streak or 0

    return {
        "user_name": current_user.name,
        "level": content_level,
        "streak": streak,
        "accuracy": accuracy,
        "words_known": words_known,
        "overall_pct": overall_pct,
        "total_lessons": total_lessons,
        "total_completed": total_completed,

        "due_cards": due_count,
        "units": units_data,
        "skills": skills,
        "study_time": {
            "today": time_today,
            "week":  time_week,
            "month": time_month,
            "year":  time_year,
            "total": time_total,
        },
        "heatmap": heatmap,
        "first_year": first_year,
    }



# ─────────────────────────────────────────────────────────────────────────────
# SM-2 ENDPOINTS  (must come BEFORE /{lesson_id} wildcard)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/sm2/due", response_model=List[FlashCardResponse])
def get_due_cards(limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns cards due for review today (SM-2 scheduled)."""
    now_utc = datetime.now(timezone.utc)
    cards = db.query(FlashCard).filter(
        FlashCard.user_id == current_user.id,
        FlashCard.due_date <= now_utc
    ).order_by(FlashCard.due_date.asc()).limit(limit).all()
    return cards


@router.get("/sm2/weak", response_model=List[FlashCardResponse])
def get_weak_cards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns cards flagged as weak areas (high error rate)."""
    cards = db.query(FlashCard).filter(
        FlashCard.user_id == current_user.id,
        FlashCard.is_weak == True
    ).order_by(FlashCard.incorrect_count.desc()).limit(20).all()
    return cards


@router.get("/sm2/all", response_model=List[FlashCardResponse])
def get_all_cards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all flashcards for the user."""
    return db.query(FlashCard).filter(FlashCard.user_id == current_user.id).all()


@router.post("/sm2/submit", response_model=SM2SubmitResponse)
def submit_sm2_review(
    payload: SM2SubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit an SM-2 review. Computes quality from velocity metrics,
    runs the SM-2 algorithm, updates card state and logs velocity.
    """
    card = db.query(FlashCard).filter(
        FlashCard.id == payload.card_id,
        FlashCard.user_id == current_user.id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    hesitation_score = compute_hesitation_score(payload.response_time_ms, payload.hesitation_count)
    quality = compute_quality_from_velocity(
        payload.response_time_ms, hesitation_score, payload.is_correct
    )
    new_ef, new_interval, new_reps = sm2_next(
        card.easiness, card.interval, card.repetitions, quality
    )
    new_due = compute_due_date(new_interval)

    card.easiness = new_ef
    card.interval = new_interval
    card.repetitions = new_reps
    card.due_date = new_due
    card.last_reviewed = datetime.now(timezone.utc)

    if payload.is_correct:
        card.correct_count += 1
    else:
        card.incorrect_count += 1

    total = card.correct_count + card.incorrect_count
    card.is_weak = (card.incorrect_count >= 2 and (card.incorrect_count / total) >= 0.4)

    vel = VelocityLog(
        user_id=current_user.id,
        lesson_id=card.lesson_id,
        card_id=card.id,
        response_time_ms=payload.response_time_ms,
        answer_duration_ms=payload.answer_duration_ms,
        hesitation_count=payload.hesitation_count,
        hesitation_score=hesitation_score,
        quality=quality,
        transcript=payload.transcript
    )
    db.add(vel)
    db.commit()

    msg = "Great job! 🎉" if quality >= 4 else ("Good effort! 👍" if quality == 3 else "Keep practicing! 💪")
    return SM2SubmitResponse(
        card_id=card.id,
        new_interval=new_interval,
        new_easiness=round(new_ef, 3),
        new_repetitions=new_reps,
        quality=quality,
        hesitation_score=hesitation_score,
        is_weak=card.is_weak,
        next_due=new_due,
        message=msg
    )


@router.post("/sm2/seed/{lesson_id}", response_model=SeedCardsResponse)
def seed_cards_for_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually seeds SM-2 flashcards from a lesson's content_data."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    count = _seed_cards_for_lesson(db, current_user.id, lesson)
    return SeedCardsResponse(seeded=count, message=f"Seeded {count} flashcards from '{lesson.title}'")


# ─────────────────────────────────────────────────────────────────────────────
# VELOCITY ENDPOINTS  (also before wildcard)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/velocity/log")
def log_velocity(
    payload: VelocityLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hs = compute_hesitation_score(payload.response_time_ms, payload.hesitation_count)
    vel = VelocityLog(
        user_id=current_user.id,
        lesson_id=payload.lesson_id,
        card_id=payload.card_id,
        response_time_ms=payload.response_time_ms,
        answer_duration_ms=payload.answer_duration_ms,
        hesitation_count=payload.hesitation_count,
        hesitation_score=hs,
        quality=3,
        transcript=payload.transcript
    )
    db.add(vel)
    db.commit()
    return {"logged": True, "hesitation_score": hs}


@router.get("/velocity/stats", response_model=VelocityStatsResponse)
def get_velocity_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    logs = db.query(VelocityLog).filter(
        VelocityLog.user_id == current_user.id
    ).order_by(VelocityLog.created_at.desc()).limit(100).all()

    if not logs:
        return VelocityStatsResponse(
            avg_response_time_ms=0, avg_hesitation_score=0, avg_quality=0,
            total_reviews=0, speed_label="No data", hesitation_label="No data",
            trend=[], weak_areas=[]
        )

    avg_rt = sum(l.response_time_ms for l in logs) / len(logs)
    avg_hs = sum(l.hesitation_score for l in logs) / len(logs)
    avg_q  = sum(l.quality for l in logs) / len(logs)

    speed_label = "Fast" if avg_rt < 2000 else ("Moderate" if avg_rt < 4000 else "Slow")
    hes_label   = "Confident" if avg_hs < 0.3 else ("Some hesitation" if avg_hs < 0.6 else "High hesitation")

    trend = [
        {
            "index": i,
            "response_time_ms": logs[i].response_time_ms,
            "hesitation_score": logs[i].hesitation_score,
            "quality": logs[i].quality,
            "created_at": logs[i].created_at.isoformat() if logs[i].created_at else None
        }
        for i in range(min(7, len(logs)))
    ]
    trend.reverse()

    weak_cards = db.query(FlashCard.front).filter(
        FlashCard.user_id == current_user.id,
        FlashCard.is_weak == True
    ).limit(10).all()
    weak_areas = [row[0] for row in weak_cards]

    return VelocityStatsResponse(
        avg_response_time_ms=round(avg_rt, 1),
        avg_hesitation_score=round(avg_hs, 3),
        avg_quality=round(avg_q, 2),
        total_reviews=len(logs),
        speed_label=speed_label,
        hesitation_label=hes_label,
        trend=trend,
        weak_areas=weak_areas
    )


# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id = current_user.id

    CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

    # ── Step 1: ALWAYS ensure A1 curriculum exists with correct label ─────────
    # Old code stored A1 content under wrong level labels like 'B1'.
    # We fix this by guaranteeing properly-labelled A1 units are always present.
    a1_units_exist = db.query(Unit).filter(Unit.level == "A1").count() > 0
    if not a1_units_exist:
        a1_data = generate_personalized_units("A1")
        for u_data in a1_data:
            new_unit = Unit(
                title=u_data["title"], description=u_data["description"],
                level="A1", order=u_data["order"], icon=u_data["icon"]
            )
            db.add(new_unit)
            db.flush()
            for l_data in u_data["lessons"]:
                db.add(Lesson(
                    unit_id=new_unit.id, title=l_data["title"],
                    content_type=l_data["content_type"],
                    content_data=json.dumps(l_data["content_data"]),
                    order=l_data["order"]
                ))
        db.commit()

    # ── Step 1b: Ensure A2 curriculum exists ──────────────────────────────────
    a2_units_exist = db.query(Unit).filter(Unit.level == "A2").count() > 0
    if not a2_units_exist:
        a2_data = generate_personalized_units("A2")
        for u_data in a2_data:
            new_unit = Unit(
                title=u_data["title"], description=u_data["description"],
                level="A2", order=u_data["order"], icon=u_data["icon"]
            )
            db.add(new_unit)
            db.flush()
            for l_data in u_data["lessons"]:
                db.add(Lesson(
                    unit_id=new_unit.id, title=l_data["title"],
                    content_type=l_data["content_type"],
                    content_data=json.dumps(l_data["content_data"]),
                    order=l_data["order"]
                ))
        db.commit()

    # ── Step 2: Walk CEFR_ORDER to find the user's current content level ──────
    # A level is "done" only when ALL its lessons are completed.
    # Only properly-labeled levels (seeded correctly) are considered.
    content_level = "A1"
    for cefr in CEFR_ORDER:
        cefr_units = db.query(Unit).filter(Unit.level == cefr).all()
        if not cefr_units:
            break  # No curriculum beyond this point
        total_l = sum(
            db.query(Lesson).filter(Lesson.unit_id == u.id).count()
            for u in cefr_units
        )
        done_l = sum(
            db.query(UserLessonCompletion).join(Lesson).filter(
                Lesson.unit_id == u.id, UserLessonCompletion.user_id == user_id
            ).count()
            for u in cefr_units
        )
        content_level = cefr
        if done_l < total_l:
            break  # Still incomplete at this level — stay here

    # ── Step 3: Fetch display units for all levels up to current content level ──
    levels_to_fetch = CEFR_ORDER[:CEFR_ORDER.index(content_level) + 1]
    units = db.query(Unit).filter(Unit.level.in_(levels_to_fetch)).order_by(Unit.level, Unit.order).all()

    # ── 3. Compute stats ──────────────────────────────────────────────────────
    accuracy_avg = db.query(func.avg(TestResult.score)).filter(TestResult.user_id == user_id).scalar() or 0.0
    accuracy_percent = round(accuracy_avg * 100, 1)

    completed_lessons_count = db.query(UserLessonCompletion).join(Lesson).join(Unit).filter(
        Unit.level == content_level, UserLessonCompletion.user_id == user_id
    ).count()
    
    base_words = {"A1": 0, "A2": 500, "B1": 1500, "B2": 3000, "C1": 5000, "C2": 10000}.get(content_level, 0)
    words_known = base_words + (completed_lessons_count * 15)

    # ── 4. SM-2 due cards + weak areas ────────────────────────────────────────
    now_utc = datetime.now(timezone.utc)
    due_count = db.query(FlashCard).filter(
        FlashCard.user_id == user_id,
        FlashCard.due_date <= now_utc
    ).count()

    weak_cards = db.query(FlashCard.front).filter(
        FlashCard.user_id == user_id,
        FlashCard.is_weak == True
    ).limit(5).all()
    weak_areas = [row[0] for row in weak_cards]

    # ── 5. Build unit/lesson response ─────────────────────────────────────────
    completed_ids = {
        row[0] for row in db.query(UserLessonCompletion.lesson_id)
        .filter(UserLessonCompletion.user_id == user_id).all()
    }

    unit_responses = []
    for u in units:
        lessons = db.query(Lesson).filter(Lesson.unit_id == u.id).order_by(Lesson.order).all()
        lesson_data = [
            LessonResponse(
                id=l.id, unit_id=l.unit_id, title=l.title,
                content_type=l.content_type,
                content_data=json.loads(l.content_data),
                order=l.order, is_completed=(l.id in completed_ids)
            )
            for l in lessons
        ]
        unit_responses.append(UnitResponse(
            id=u.id, title=u.title, description=u.description,
            level=u.level, order=u.order, icon=u.icon,
            lessons=lesson_data
        ))

    streak = current_user.current_streak if current_user.current_streak else 0

    return DashboardResponse(
        user_name=current_user.name or "Student",
        current_level=content_level,           # ← always the learning content level
        streak=streak,
        accuracy=accuracy_percent,
        words_known=words_known,
        hours_total=round(completed_lessons_count * 0.08, 1),
        units=unit_responses,
        due_cards_count=due_count,
        weak_areas=weak_areas
    )


# ─────────────────────────────────────────────────────────────────────────────
# LESSON DETAIL + COMPLETE  (wildcard — must be LAST)
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_lesson(lesson_id: str, db: Session) -> Lesson:
    """Try resolving as int ID first, then as slug like a1_unit4_lesson02 or a2_unit7_lesson01."""
    # 1. Try integer ID
    try:
        lid = int(lesson_id)
        return db.query(Lesson).filter(Lesson.id == lid).first()
    except ValueError:
        pass

    # 2. Try slug format: {level}_unit{X}_lesson{YY}
    for prefix, level in [("a1_unit", "A1"), ("a2_unit", "A2")]:
        if lesson_id.startswith(prefix):
            try:
                parts = lesson_id.split("_")
                # parts[0]=a1/a2, parts[1]=unitX, parts[2]=lessonYY
                unit_num = int(parts[1].replace("unit", ""))
                order = int(parts[2].replace("lesson", ""))

                # A2 units: unit7->order1, unit8->order2, unit9->order3, unit10->order4, unit11->order5
                if level == "A2":
                    unit_order = unit_num - 6  # unit7->1, unit8->2, unit9->3, unit10->4, unit11->5
                else:
                    unit_order = unit_num

                unit = db.query(Unit).filter(Unit.level == level, Unit.order == unit_order).first()
                if unit:
                    return db.query(Lesson).filter(Lesson.unit_id == unit.id, Lesson.order == order).first()
            except (ValueError, IndexError):
                pass

    return None

@router.get("/{lesson_id}", response_model=LessonResponse)
def get_lesson_details(lesson_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lesson = _resolve_lesson(lesson_id, db)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    is_completed = db.query(UserLessonCompletion).filter(
        UserLessonCompletion.user_id == current_user.id,
        UserLessonCompletion.lesson_id == lesson.id
    ).count() > 0

    return LessonResponse(id=lesson.id, unit_id=lesson.unit_id, title=lesson.title,
                          content_type=lesson.content_type,
                          content_data=json.loads(lesson.content_data),
                          order=lesson.order, is_completed=is_completed)

@router.post("/{lesson_id}/complete")
def complete_lesson(lesson_id: str, payload: CompleteLessonRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lesson = _resolve_lesson(lesson_id, db)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    # Record completion for this user
    existing_completion = db.query(UserLessonCompletion).filter(
        UserLessonCompletion.user_id == current_user.id,
        UserLessonCompletion.lesson_id == lesson.id
    ).first()
    if not existing_completion:
        new_completion = UserLessonCompletion(user_id=current_user.id, lesson_id=lesson.id)
        db.add(new_completion)

    # Log accuracy as TestResult so dashboard query picks it up
    tr = TestResult(
        user_id=current_user.id,
        question_type="lesson_completion",
        question_id=lesson.id,
        score=payload.accuracy,
    )
    db.add(tr)

    # Update Streak
    # Use IST offset (UTC+5:30) for date comparison so midnight in India is correct
    IST_OFFSET = timedelta(hours=5, minutes=30)
    now_utc = datetime.now(timezone.utc)
    now_local_date = (now_utc + IST_OFFSET).date()

    if current_user.last_active_date:
        # Normalise stored last_active_date to IST local date
        last_utc = current_user.last_active_date
        if last_utc.tzinfo is None:
            last_utc = last_utc.replace(tzinfo=timezone.utc)
        last_local_date = (last_utc + IST_OFFSET).date()
        diff_days = (now_local_date - last_local_date).days
        if diff_days == 1:
            # Consecutive day — extend streak
            current_user.current_streak = (current_user.current_streak or 0) + 1
        elif diff_days > 1:
            # Missed days — reset to 1
            current_user.current_streak = 1
        # diff_days == 0 → same local day, keep streak as-is
    else:
        # First ever activity
        current_user.current_streak = 1

    current_user.last_active_date = now_utc
    
    # ── XP CALCULATION ────────────────────────────────────────────────────────
    # Base XP for completing the lesson
    base_xp = 10 
    # Accuracy Bonus (0-10 XP)
    acc_bonus = int((payload.accuracy or 0) * 10)
    
    # Velocity Bonus (0 or 5 XP)
    # Check recent response times for this specific lesson session
    velocity_bonus = 0
    recent_logs = db.query(VelocityLog).filter(
        VelocityLog.user_id == current_user.id,
        VelocityLog.lesson_id == lesson.id
    ).order_by(VelocityLog.id.desc()).limit(10).all()
    
    if recent_logs:
        avg_rt = sum(l.response_time_ms for l in recent_logs) / len(recent_logs)
        if avg_rt < 4000: # If average response is under 4 seconds, they are fast!
            velocity_bonus = 5
            
    earned_xp = base_xp + acc_bonus + velocity_bonus
    current_user.total_xp = (current_user.total_xp or 0) + earned_xp

    db.commit()
    _seed_cards_for_lesson(db, current_user.id, lesson)
    return {
        "message": "Lesson completed", 
        "lesson_id": lesson_id, 
        "earned_xp": earned_xp,
        "total_xp": current_user.total_xp
    }


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL
# ─────────────────────────────────────────────────────────────────────────────

def _seed_cards_for_lesson(db: Session, user_id: int, lesson: Lesson) -> int:
    try:
        data = json.loads(lesson.content_data)
    except Exception:
        return 0

    flashcards: list = []

    # ── Old format: top-level flashcards list ─────────────────────────────────
    flashcards.extend(data.get("flashcards", []))

    # ── New interactive format: scan all tasks ────────────────────────────────
    tasks = data.get("tasks", [])
    for task in tasks:
        ttype = task.get("type", "")

        # Legacy FLASHCARD task
        if ttype == "FLASHCARD":
            td = task.get("data", {})
            front = td.get("primary_text", "")
            back = td.get("secondary_text", "")
            if front and back:
                flashcards.append({"front": front, "back": back})

        # New format: learn_card — extract vocabulary from items, groups, and table rows
        elif ttype in ("learn_card", "vocabulary"):
            content = task.get("content", {})
            # items list: [{phrase, note}]
            for item in content.get("items", []):
                phrase = item.get("phrase", item.get("word", "")).strip()
                note = item.get("note", item.get("definition", item.get("translation", ""))).strip()
                if phrase and note:
                    flashcards.append({"front": phrase, "back": note})
            # groups list — items can be plain strings or [{word/phrase, definition/note}]
            for group in content.get("groups", []):
                group_name = group.get("group", "")
                for item in group.get("items", []):
                    if isinstance(item, str):
                        # Plain string item e.g. emotion words — use group name as context
                        if item.strip() and group_name:
                            flashcards.append({"front": item.strip(), "back": f"{group_name} emotion / feeling"})
                    elif isinstance(item, dict):
                        word = item.get("word", item.get("phrase", "")).strip()
                        defn = item.get("definition", item.get("note", item.get("translation", ""))).strip()
                        if word and defn:
                            flashcards.append({"front": word, "back": defn})

        # New format: MCQ — make flashcard from question+correct answer
        elif ttype in ("mcq", "scenario_mcq"):
            c = task.get("content", {})
            question = c.get("question", "").strip()
            options = c.get("options", [])
            correct_idx = c.get("correct_index", 0)
            explanation = c.get("explanation", "").strip()
            if question and options and correct_idx is not None:
                correct_answer = options[correct_idx] if correct_idx < len(options) else ""
                if correct_answer:
                    back = correct_answer
                    if explanation:
                        back = f"{correct_answer} — {explanation}"
                    flashcards.append({"front": question[:120], "back": back[:200]})

    count = 0
    for fc in flashcards:
        front = str(fc.get("front", "")).strip()
        back  = str(fc.get("back", "")).strip()
        if not front or not back:
            continue
        # Skip duplicates for this user
        existing = db.query(FlashCard).filter(
            FlashCard.user_id == user_id,
            FlashCard.front == front
        ).first()
        if existing:
            continue
        card = FlashCard(user_id=user_id, lesson_id=lesson.id, front=front, back=back)
        db.add(card)
        count += 1
    if count > 0:
        db.commit()
    return count
