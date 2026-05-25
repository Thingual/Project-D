"""
Restore review session history for user 14.
May 9: 168 reviews, May 10: 55 reviews
Using the learning_sessions table which tracks daily activity.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from sqlalchemy import text
from datetime import datetime, timezone, timedelta

USER_ID = 14
db = SessionLocal()

try:
    # ── Restore learning_sessions for May 9 and May 10 ───────────────────────
    sessions_data = [
        {
            "session_date": "2026-05-09",
            "duration_minutes": 120,
            "lessons_completed": 15,
            "total_questions_answered": 168,
            "correct_answers": 145,
            "accuracy_percentage": 86.3,
            "streak_count": 7,
            "session_notes": "Restored: review session"
        },
        {
            "session_date": "2026-05-10",
            "duration_minutes": 45,
            "lessons_completed": 5,
            "total_questions_answered": 55,
            "correct_answers": 48,
            "accuracy_percentage": 87.3,
            "streak_count": 8,
            "session_notes": "Restored: review session"
        },
    ]
    
    for s in sessions_data:
        # Check if already exists for this date
        exists = db.execute(text(
            "SELECT 1 FROM learning_sessions WHERE user_id = :u AND session_date = :d"
        ), {"u": USER_ID, "d": s["session_date"]}).first()
        
        if not exists:
            db.execute(text("""
                INSERT INTO learning_sessions 
                (user_id, session_date, duration_minutes, lessons_completed,
                 total_questions_answered, correct_answers, accuracy_percentage,
                 streak_count, session_notes, created_at, updated_at)
                VALUES
                (:u, :d, :dur, :lc, :tqa, :ca, :acc, :sc, :notes, :created, :updated)
            """), {
                "u": USER_ID,
                "d": s["session_date"],
                "dur": s["duration_minutes"],
                "lc": s["lessons_completed"],
                "tqa": s["total_questions_answered"],
                "ca": s["correct_answers"],
                "acc": s["accuracy_percentage"],
                "sc": s["streak_count"],
                "notes": s["session_notes"],
                "created": datetime.fromisoformat(s["session_date"]).replace(tzinfo=timezone.utc),
                "updated": datetime.fromisoformat(s["session_date"]).replace(tzinfo=timezone.utc),
            })
            print(f"Inserted learning session for {s['session_date']}: {s['total_questions_answered']} reviews")
        else:
            print(f"Session for {s['session_date']} already exists — skipping.")
    
    db.commit()
    
    # ── Summary ───────────────────────────────────────────────────────────────
    total_completions = db.execute(text(
        "SELECT COUNT(*) FROM user_lesson_completions WHERE user_id = :u"
    ), {"u": USER_ID}).scalar()
    
    total_sessions = db.execute(text(
        "SELECT COUNT(*), SUM(total_questions_answered) FROM learning_sessions WHERE user_id = :u"
    ), {"u": USER_ID}).fetchone()
    
    print(f"\n── Final state for user {USER_ID} ──────────────────────")
    print(f"  Lesson completions: {total_completions}")
    print(f"  Learning sessions:  {total_sessions[0]}")
    print(f"  Total reviews:      {total_sessions[1]}")
    print("Done! ✓")

except Exception as e:
    db.rollback()
    print(f"ERROR: {e}")
    import traceback; traceback.print_exc()
finally:
    db.close()
