import sqlite3
import json

conn = sqlite3.connect('backend/thingual.db')
c = conn.cursor()
c.execute("SELECT id, title, content_data FROM lessons WHERE id >= 49")
rows = c.fetchall()

for row in rows:
    lesson_id, title, content_data = row
    data = json.loads(content_data)
    tasks = data.get("tasks", [])
    for t in tasks:
        if t.get("type") == "fill_blank":
            content = t.get("content", {})
            sentences = content.get("sentences", []) or content.get("items", [])
            # Let's see what keys are in each sentence/item
            keys = set()
            if isinstance(sentences, list):
                for s in sentences:
                    if isinstance(s, dict):
                        keys.update(s.keys())
            if keys:
                print(f"L{lesson_id} Task {t.get('task_id')}: Sentence/item keys: {list(keys)}")
conn.close()
