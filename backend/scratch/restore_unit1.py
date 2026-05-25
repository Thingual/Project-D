import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from database import SessionLocal
from models import Unit, Lesson, UserLessonCompletion
from sqlalchemy import text

def restore_progress():
    db = SessionLocal()
    try:
        # Find Units 1, 2, 3 A1
        units = db.query(Unit).filter(Unit.level == "A1", Unit.order.in_([1, 2, 3])).all()
        if not units:
            print("Units not found")
            return
        
        # Get lessons
        unit_ids = [u.id for u in units]
        lessons = db.query(Lesson).filter(Lesson.unit_id.in_(unit_ids)).all()
        print(f"Found {len(lessons)} lessons for Units 1, 2, 3")
        
        user_ids = [14, 18, 21, 19, 20, 17] # Might as well restore for the main users or just 14/18
        
        for uid in [14, 18]:
            # Delete any existing just in case
            unit_ids_str = ",".join(map(str, unit_ids))
            db.execute(text(f"DELETE FROM user_lesson_completions WHERE user_id = {uid} AND lesson_id IN (SELECT id FROM lessons WHERE unit_id IN ({unit_ids_str}))"))
            
            for lesson in lessons:
                completion = UserLessonCompletion(user_id=uid, lesson_id=lesson.id)
                db.add(completion)
                
            # Also update the user's total xp
            db.execute(text(f"UPDATE users SET total_xp = total_xp + {len(lessons) * 100} WHERE id = {uid}"))
            
        db.commit()
        print("Progress restored for users 14 and 18.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    restore_progress()
