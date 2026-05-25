import sqlite3
import json

conn = sqlite3.connect("thingual.db")
cursor = conn.cursor()

# Find lessons that might have tasks about obligation/prohibition or scramble tasks
cursor.execute("SELECT id, title, content_data FROM lessons")
rows = cursor.fetchall()

print(f"Total lessons found: {len(rows)}")

found = 0
for row in rows:
    lesson_id, title, content_json = row
    if not content_json:
        continue
    try:
        data = json.loads(content_json)
    except Exception as e:
        continue
    
    # Check tasks inside data
    tasks = data.get("tasks", [])
    for idx, task in enumerate(tasks):
        # Check if words/mustn't/obligation/etc is present
        task_str = json.dumps(task)
        if "mustn't" in task_str or "office" in task_str or "confidential" in task_str:
            print(f"Match in Lesson ID {lesson_id}: '{title}' (Task index {idx})")
            print(json.dumps(task, indent=2))
            found += 1
            if found > 10:
                break

conn.close()
