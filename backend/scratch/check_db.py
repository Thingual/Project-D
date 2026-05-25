import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    units = db.execute(text('SELECT id, title, level, "order" FROM units ORDER BY "order", id')).fetchall()
    print('=== UNITS ===')
    for u in units:
        print(f'  id={u[0]}, title={u[1]}, level={u[2]}, order={u[3]}')

    count = db.execute(text('SELECT COUNT(*) FROM user_lesson_completions')).scalar()
    print(f'\n=== COMPLETIONS: {count} total ===')

    by_user = db.execute(text('SELECT user_id, COUNT(*) FROM user_lesson_completions GROUP BY user_id')).fetchall()
    for r in by_user:
        print(f'  user_id={r[0]}: {r[1]} completions')

    print('\n=== LESSONS PER UNIT ===')
    lessons = db.execute(text('SELECT unit_id, COUNT(*) FROM lessons GROUP BY unit_id ORDER BY unit_id')).fetchall()
    for l in lessons:
        print(f'  unit_id={l[0]}: {l[1]} lessons')
finally:
    db.close()
