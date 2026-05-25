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
        task_str = json.dumps(task)
        if "Arrange the words to make a workplace rule" in task_str:
            print(f"Match in Lesson ID {lesson_id}: '{title}' (Task index {idx})")
            print(json.dumps(task, indent=2))

conn.close()
