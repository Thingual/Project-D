import sqlite3
import json

conn = sqlite3.connect("thingual.db")
cursor = conn.cursor()

cursor.execute("SELECT id, title, content_data FROM lessons")
rows = cursor.fetchall()

print("Scanning all sort_words / scramble tasks in DB:")
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
        if task.get("type") in ["sort_words", "scramble"]:
            c = task.get("content", {})
            print(f"Lesson {lesson_id} - Task {idx} (type={task.get('type')}):")
            print("  words:", c.get("words") or c.get("scramble"))
            print("  answer keys:", [k for k in c.keys() if "answer" in k or "correct" in k])
            print("  answer values:", {k: c[k] for k in c.keys() if "answer" in k or "correct" in k})

conn.close()
