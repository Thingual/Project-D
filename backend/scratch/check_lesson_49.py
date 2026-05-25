import sys
sys.path.insert(0, '.')
import json
from database import SessionLocal
from models import Lesson

db = SessionLocal()
try:
    lesson = db.query(Lesson).filter(Lesson.id == 49).first()
    if lesson:
        print(f"ID: {lesson.id}")
        print(f"Title: {lesson.title}")
        print(f"Type: {lesson.content_type}")
        print("Data:")
        data = json.loads(lesson.content_data)
        print(json.dumps(data, indent=2))
    else:
        print("Lesson 49 not found in DB.")
finally:
    db.close()
