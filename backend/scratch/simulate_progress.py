import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import SessionLocal
from models import User, UserLessonCompletion, Lesson, Unit
from routers.lessons import get_dashboard_data, get_progress
import json

db = SessionLocal()
try:
    user_id = 2
    user = db.query(User).filter(User.id == user_id).first()
    print(f"Before simulation: User level in dashboard:")
    db_data = get_dashboard_data(db, user)
    print(f"  Current Level: {db_data.current_level}")
    print(f"  First unit on dashboard: {db_data.units[0].title} (Level: {db_data.units[0].level})")
    
    completions = db.query(UserLessonCompletion).filter(UserLessonCompletion.user_id == user_id).all()
    print(f"  Completed count: {len(completions)}")

    # Mark all A1 lessons completed
    print("\nSimulating completing all A1 lessons...")
    a1_units = db.query(Unit).filter(Unit.level == "A1").all()
    a1_unit_ids = [u.id for u in a1_units]
    a1_lessons = db.query(Lesson).filter(Lesson.unit_id.in_(a1_unit_ids)).all()
    
    # Clear existing completions first
    db.query(UserLessonCompletion).filter(UserLessonCompletion.user_id == user_id).delete()
    db.commit()
    
    for l in a1_lessons:
        db.add(UserLessonCompletion(user_id=user_id, lesson_id=l.id))
    db.commit()
    print(f"Marked {len(a1_lessons)} A1 lessons as completed.")

    # Now let's query the dashboard again
    print("\nAfter simulating A1 completion: User level in dashboard:")
    db_data = get_dashboard_data(db, user)
    print(f"  Current Level: {db_data.current_level}")
    print(f"  First unit on dashboard: {db_data.units[0].title} (Level: {db_data.units[0].level})")
    print(f"  Units list returned:")
    for u in db_data.units:
        print(f"    - Unit {u.order}: {u.title} (Level: {u.level})")

    # Let's query progress endpoint
    print("\nProgress endpoint response:")
    prog_data = get_progress(year=None, db=db, current_user=user)
    print(f"  Level: {prog_data['level']}")
    print(f"  Overall Percent: {prog_data['overall_pct']}%")
    print(f"  Total Lessons: {prog_data['total_lessons']}")
    print(f"  Total Completed: {prog_data['total_completed']}")
    print(f"  Units in progress:")
    for u in prog_data['units']:
        print(f"    - Unit {u['order']}: {u['title']} ({u['completed']}/{u['total']} completed, {u['pct']}% done)")

    # Clean up completions so the user is back to normal
    print("\nCleaning up completions...")
    db.query(UserLessonCompletion).filter(UserLessonCompletion.user_id == user_id).delete()
    db.commit()
    print("Cleaned up successfully.")

except Exception as e:
    db.rollback()
    print(f"Error in simulation: {e}")
finally:
    db.close()
