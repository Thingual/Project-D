import sqlite3
import json

conn = sqlite3.connect("thingual.db")
cursor = conn.cursor()

cursor.execute("SELECT id, title, content_data FROM lessons")
rows = cursor.fetchall()

scramble_types = set()
for row in rows:
    lesson_id, title, content_json = row
    if not content_json:
        continue
    try:
        data = json.loads(content_json)
    except Exception as e:
        continue
    
    tasks = data.get("tasks", [])
    for task in tasks:
        ttype = task.get("type")
        if ttype and "scramble" in ttype.lower() or "sort" in ttype.lower():
            scramble_types.add(ttype)

print("Scramble task types found in database:", scramble_types)
conn.close()
