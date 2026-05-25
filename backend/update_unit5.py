import os
import json
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import sys

sys.path.insert(0, os.path.dirname(__file__))
from utils.lesson_generator import _build_unit5_lessons_from_json

load_dotenv('.env')
db_url = os.getenv("DATABASE_URL")

engine = create_engine(db_url)
with engine.connect() as conn:
    # Get Unit 5 ID
    row = conn.execute(text("SELECT id FROM units WHERE \"order\" = 5 AND level = 'A1'")).fetchone()
    if not row:
        print("Unit 5 not found")
        exit(1)
    unit_id = row[0]
    print(f"Unit 5 ID: {unit_id}")

    lessons = _build_unit5_lessons_from_json()
    for lesson_data in lessons:
        title = lesson_data['title']
        content_data = json.dumps(lesson_data['content_data'])
        conn.execute(
            text("UPDATE lessons SET content_data = :cd WHERE unit_id = :uid AND title = :t"),
            {"cd": content_data, "uid": unit_id, "t": title}
        )
        print(f"Updated lesson: {title}")

    conn.commit()
    print("Done updating Unit 5.")
