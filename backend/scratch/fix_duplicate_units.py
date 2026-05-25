"""
Fix: Remove duplicate units and remap user_lesson_completions to the surviving lessons.

Strategy:
  - For each (level, order) group, KEEP the unit with the HIGHEST id (most recent re-seed).
  - Map old lesson IDs → new lesson IDs by matching (unit order, lesson order).
  - Update user_lesson_completions to use new lesson IDs.
  - Delete old units (and their lessons via cascade or explicit delete).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Step 1: Find the canonical (latest) unit ID per (level, order)
    all_units = db.execute(text(
        'SELECT id, title, level, "order" FROM units ORDER BY level, "order", id'
    )).fetchall()

    # Group by (level, order)
    from collections import defaultdict
    groups = defaultdict(list)
    for uid, title, level, order in all_units:
        groups[(level, order)].append(uid)

    # Keep highest ID per group, discard the rest
    keep_ids = set()
    discard_ids = set()
    for (level, order), ids in groups.items():
        keep = max(ids)
        keep_ids.add(keep)
        for i in ids:
            if i != keep:
                discard_ids.add(i)

    print(f"Keeping {len(keep_ids)} units: {sorted(keep_ids)}")
    print(f"Removing {len(discard_ids)} duplicate units: {sorted(discard_ids)}")

    if not discard_ids:
        print("No duplicates found! Nothing to do.")
        db.close()
        exit(0)

    # Step 2: For each discard unit, map its lessons → the corresponding keep unit's lessons
    # Lessons are matched by their order within a unit.
    # build: old_lesson_id → new_lesson_id
    lesson_remap = {}
    for (level, order), ids in groups.items():
        keep = max(ids)
        old_ids = [i for i in ids if i != keep]

        # Get new lessons (sorted by lesson order)
        new_lessons = db.execute(text(
            'SELECT id, "order" FROM lessons WHERE unit_id = :u ORDER BY "order"'
        ), {"u": keep}).fetchall()
        new_map = {row[1]: row[0] for row in new_lessons}  # order → lesson_id

        for old_unit_id in old_ids:
            old_lessons = db.execute(text(
                'SELECT id, "order" FROM lessons WHERE unit_id = :u ORDER BY "order"'
            ), {"u": old_unit_id}).fetchall()
            for old_lesson_id, lesson_order in old_lessons:
                new_lesson_id = new_map.get(lesson_order)
                if new_lesson_id:
                    lesson_remap[old_lesson_id] = new_lesson_id

    print(f"\nLesson remap ({len(lesson_remap)} entries):")
    for old, new in sorted(lesson_remap.items()):
        print(f"  lesson {old} -> {new}")

    # Step 3: Update user_lesson_completions
    updated = 0
    for old_lid, new_lid in lesson_remap.items():
        # Check if completion already exists for the new_lid
        exists_new = db.execute(text(
            "SELECT 1 FROM user_lesson_completions WHERE user_id=14 AND lesson_id=:l"
        ), {"l": new_lid}).first()

        exists_old = db.execute(text(
            "SELECT 1 FROM user_lesson_completions WHERE user_id=14 AND lesson_id=:l"
        ), {"l": old_lid}).first()

        if exists_old and not exists_new:
            db.execute(text(
                "UPDATE user_lesson_completions SET lesson_id=:new WHERE lesson_id=:old AND user_id=14"
            ), {"new": new_lid, "old": old_lid})
            updated += 1
        elif exists_old and exists_new:
            # Both exist — just delete the old one
            db.execute(text(
                "DELETE FROM user_lesson_completions WHERE lesson_id=:old AND user_id=14"
            ), {"old": old_lid})

    print(f"\nUpdated {updated} completions.")

    # Step 4: Delete lessons of discard units, then the units themselves
    for uid in discard_ids:
        db.execute(text("DELETE FROM lessons WHERE unit_id=:u"), {"u": uid})
    for uid in discard_ids:
        db.execute(text("DELETE FROM units WHERE id=:u"), {"u": uid})

    db.commit()

    # Verify
    remaining = db.execute(text('SELECT id, title, level, "order" FROM units ORDER BY level, "order"')).fetchall()
    print(f"\n=== Remaining units ({len(remaining)}) ===")
    for r in remaining:
        print(f"  id={r[0]}, {r[2]} order={r[3]}: {r[1]}")

    comp_count = db.execute(text("SELECT COUNT(*) FROM user_lesson_completions WHERE user_id=14")).scalar()
    print(f"\nUser 14 completions: {comp_count}")

    # Check which unit each completion belongs to
    comps = db.execute(text("""
        SELECT u.title, u."order", COUNT(*) 
        FROM user_lesson_completions ulc
        JOIN lessons l ON l.id = ulc.lesson_id
        JOIN units u ON u.id = l.unit_id
        WHERE ulc.user_id = 14
        GROUP BY u.id, u.title, u."order"
        ORDER BY u."order"
    """)).fetchall()
    print("\nCompletions by unit:")
    for c in comps:
        print(f"  Unit {c[1]} ({c[0]}): {c[2]} completed lessons")

except Exception as e:
    db.rollback()
    import traceback; traceback.print_exc()
    print(f"ERROR: {e}")
finally:
    db.close()
