import sqlite3
import json

conn = sqlite3.connect("thingual.db")
cursor = conn.cursor()

cursor.execute("SELECT id, title, content_data FROM lessons")
rows = cursor.fetchall()

for row in rows:
    lesson_id, title, content_json = row
    if not content_json:
        continue
    try:
        data = json.loads(content_json)
    except Exception as e:
        continue
    
    tasks = data.get("tasks", [])
    for idx, task in enumerate(tasks):
        if task.get("type") == "SCRAMBLE":
            print(f"Lesson {lesson_id} ('{title}') has SCRAMBLE task at index {idx}")

conn.close()
