import sqlite3
import json

conn = sqlite3.connect("thingual.db")
cursor = conn.cursor()

cursor.execute("SELECT content_data FROM lessons WHERE id = 53")
row = cursor.fetchone()
if row:
    lesson_data = json.loads(row[0])
    tasks = lesson_data.get("tasks", [])
    t = tasks[11] # Task index 11
    print("Task 11 keys:", list(t.keys()))
    print("Task 11 type:", t.get("type"))
    print("Task 11 content keys:", list(t.get("content", {}).keys()))
    print("Task 11 content answer:", t.get("content", {}).get("answer"))
    print("Task 11 content explanation:", t.get("content", {}).get("explanation"))
else:
    print("Lesson not found")

conn.close()
