import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import SessionLocal
from models import User, UserLessonCompletion, Lesson, Unit
from sqlalchemy import func

db = SessionLocal()
try:
    users = db.query(User).all()
    print("Users in Database:")
    for u in users:
        completions = db.query(UserLessonCompletion).filter(UserLessonCompletion.user_id == u.id).count()
        print(f"  ID: {u.id}, Name: {u.name}, Email: {u.email}, XP: {u.total_xp}, Streak: {u.current_streak}, Completions count: {completions}")
except Exception as e:
    print(f"Error checking: {e}")
finally:
    db.close()
