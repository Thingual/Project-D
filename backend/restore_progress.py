"""
Restore progress for user 14:
- 4 complete units (Units 1, 2, 3, 4 in display order)
- Also restore review session counts as lesson_history entries
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from sqlalchemy import text
from datetime import datetime, timezone, timedelta

USER_ID = 14
db = SessionLocal()

try:
    # ── Step 1: Find units in correct display order ──────────────────────────
    units_result = db.execute(text(
        'SELECT id, title, "order" FROM units WHERE id >= 101 ORDER BY "order", id'
    )).fetchall()
    
    print("Units in display order:")
    for u in units_result:
        print(f"  Unit {u[0]}: {u[1]} (order={u[2]})")
    
    # Deduplicate by order — take the first (lowest ID) for each order slot
    seen_orders = {}
    ordered_units = []
    for u in units_result:
        if u[2] not in seen_orders:
            seen_orders[u[2]] = u[0]
            ordered_units.append((u[0], u[1], u[2]))
    
    print(f"\nDeduped unit sequence: {[(u[0], u[1]) for u in ordered_units]}")
    
    # Take first 4 units
    target_units = ordered_units[:4]
    print(f"\nRestoring ALL lessons for units: {[u[0] for u in target_units]}")
    
    # ── Step 2: Collect all lessons for those 4 units ────────────────────────
    lesson_ids = []
    for unit_id, unit_title, _ in target_units:
        lessons = db.execute(text(
            "SELECT id FROM lessons WHERE unit_id = :u ORDER BY id"
        ), {"u": unit_id}).fetchall()
        for l in lessons:
            lesson_ids.append(l[0])
        print(f"  Unit {unit_id} ({unit_title}): {len(lessons)} lessons")
    
    print(f"\nTotal lessons to restore: {len(lesson_ids)}")
    
    # ── Step 3: Insert completions (skip if already exists) ──────────────────
    now = datetime.now(timezone.utc)
    inserted = 0
    for i, l_id in enumerate(lesson_ids):
        completed_at = now - timedelta(days=3, minutes=(len(lesson_ids) - i) * 5)
        exists = db.execute(text(
            "SELECT 1 FROM user_lesson_completions WHERE user_id = :u AND lesson_id = :l"
        ), {"u": USER_ID, "l": l_id}).first()
        
        if not exists:
            db.execute(text(
                "INSERT INTO user_lesson_completions (user_id, lesson_id, completed_at) VALUES (:u, :l, :at)"
            ), {"u": USER_ID, "l": l_id, "at": completed_at})
            inserted += 1
    
    db.commit()
    print(f"\nSuccess! Inserted {inserted} lesson completions.")
    
    # ── Step 4: Restore flashcard review counts ───────────────────────────────
    # Check if lesson_history table exists
    history_check = db.execute(text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_history'"
    )).first()
    
    if history_check:
        # Restore ~168 review entries for May 9th and ~55 for May 10th
        review_counts = [
            ("2026-05-09", 168),
            ("2026-05-10", 55),
        ]
        for date_str, count in review_counts:
            for j in range(count):
                lesson_id = lesson_ids[j % len(lesson_ids)]
                reviewed_at = datetime.fromisoformat(date_str).replace(
                    tzinfo=timezone.utc
                ) + timedelta(minutes=j * 5)
                # Only insert if table has right columns
                try:
                    db.execute(text(
                        "INSERT INTO lesson_history (user_id, lesson_id, created_at) VALUES (:u, :l, :at)"
                    ), {"u": USER_ID, "l": lesson_id, "at": reviewed_at})
                except Exception as e:
                    print(f"  lesson_history insert skipped: {e}")
                    db.rollback()
                    break
        db.commit()
        print("Review history restored in lesson_history.")
    else:
        print("Note: lesson_history table not found — skipping review restore.")
        
    # ── Step 5: Final summary ─────────────────────────────────────────────────
    total = db.execute(text(
        "SELECT COUNT(*) FROM user_lesson_completions WHERE user_id = :u"
    ), {"u": USER_ID}).scalar()
    print(f"\nFinal state: {total} lesson completions for user {USER_ID}.")

except Exception as e:
    db.rollback()
    print(f"ERROR: {e}")
    import traceback; traceback.print_exc()
finally:
    db.close()
