import sqlite3
import json

conn = sqlite3.connect("thingual.db")
cursor = conn.cursor()

# Find Lesson 53
cursor.execute("SELECT content_data FROM lessons WHERE id = 53")
row = cursor.fetchone()
if row:
    content_data = json.loads(row[0])
    tasks = content_data.get("tasks", [])
    print("Lesson 53 Tasks:")
    for i, t in enumerate(tasks):
        if t.get("type") == "sort_words":
            print(f"\nTask {i} ({t.get('task_id')}):")
            print("  content keys:", list(t.get("content", {}).keys()))
            print("  content answer:", t.get("content", {}).get("answer"))
            print("  task answer:", t.get("answer"))
else:
    print("Lesson 53 not found in DB")

conn.close()
