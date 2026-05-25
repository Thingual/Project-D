import sqlite3
import json

conn = sqlite3.connect('backend/thingual.db')
c = conn.cursor()
c.execute("SELECT content_data FROM lessons WHERE id = 49")
row = c.fetchone()
if row:
    data = json.loads(row[0])
    tasks = data.get("tasks", [])
    
    # Task 9 (0-indexed 8)
    print("=== Task 9 (fill_blank) ===")
    print(json.dumps(tasks[8], indent=2))
    
    # Task 11 (0-indexed 10)
    print("\n=== Task 11 (sort_words) ===")
    print(json.dumps(tasks[10], indent=2))

    # Task 19 (0-indexed 18)
    print("\n=== Task 19 (fill_blank paragraph) ===")
    print(json.dumps(tasks[18], indent=2))
conn.close()
