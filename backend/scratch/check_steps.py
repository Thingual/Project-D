import sqlite3
import json

conn = sqlite3.connect("thingual.db")
cursor = conn.cursor()

cursor.execute("SELECT content_data FROM lessons WHERE id = 53")
row = cursor.fetchone()
if row:
    lesson_data = json.loads(row[0])
    tasks = lesson_data.get("tasks", [])
    print("Found tasks count:", len(tasks))
    for i, t in enumerate(tasks):
        if t.get("type") == "sort_words":
            c = t.get("content", {})
            print(f"\nTask index {i}:")
            print("  c.answer:", c.get("answer"))
            print("  task.answer:", t.get("answer"))
            print("  c.correct_sequence:", c.get("correct_sequence"))
            print("  c.correct_sentence:", c.get("correct_sentence"))
else:
    print("Lesson not found")

conn.close()
