from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    r = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'lesson_history' ORDER BY ordinal_position"))
    cols = [row[0] for row in r]
    print("lesson_history columns:", cols)
    
    # Also check learning_sessions columns
    r2 = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'learning_sessions' ORDER BY ordinal_position"))
    cols2 = [row[0] for row in r2]
    print("learning_sessions columns:", cols2)

finally:
    db.close()
