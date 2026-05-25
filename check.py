import sqlite3, json

conn = sqlite3.connect('backend/test.db')
c = conn.cursor()
c.execute('SELECT content_data FROM lessons WHERE id=816')
row = c.fetchone()
if row:
    data = json.loads(row[0])
    print('Found tasks:', len(data.get('tasks', [])))
    for t in data.get('tasks', []):
        if t.get('type') == 'match_pairs':
            print('Found match_pairs:', t)
else:
    print('Lesson 816 not found')
