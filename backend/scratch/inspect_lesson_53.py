import sqlite3
import json

conn = sqlite3.connect("thingual.db")
cursor = conn.cursor()

cursor.execute("SELECT id, title, content_data FROM lessons WHERE id = 53")
row = cursor.fetchone()
if row:
    lesson_id, title, content_json = row
    print("Lesson ID:", lesson_id)
    print("Title:", title)
    try:
        data = json.loads(content_json)
        print("Keys in content_data:", list(data.keys()))
        if "tasks" in data:
            print("Number of tasks:", len(data["tasks"]))
            for i, t in enumerate(data["tasks"]):
                print(f"Task {i}: type={t.get('type')}, keys={list(t.keys())}")
        else:
            print("No tasks at root of content_data")
    except Exception as e:
        print("Error parsing JSON:", e)
else:
    print("Lesson 53 not found")

conn.close()
