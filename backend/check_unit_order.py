from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    result = db.execute(text("SELECT id, title, \"order\" FROM units WHERE id >= 101 ORDER BY \"order\""))
    for r in result:
        print(f"Unit {r[0]}: {r[1]} (Order: {r[2]})")
finally:
    db.close()
