import sqlite3
import json

conn = sqlite3.connect('backend/thingual.db')
c = conn.cursor()
c.execute("SELECT content_data FROM lessons WHERE id = 53")
row = c.fetchone()
if row:
    data = json.loads(row[0])
    tasks = data.get("tasks", [])
    # Print task 11 (index 10) and task 12 (index 11)
    print("=== Task 11 ===")
    print(json.dumps(tasks[10], indent=2))
    print("\n=== Task 12 ===")
    print(json.dumps(tasks[11], indent=2))
conn.close()
