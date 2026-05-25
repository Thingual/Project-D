import os, json
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv("DATABASE_URL")
engine = create_engine(db_url)

with engine.connect() as conn:
    row = conn.execute(text(
        "SELECT id, title, content_data FROM lessons WHERE unit_id = 107 ORDER BY \"order\" LIMIT 1"
    )).fetchone()

    if row:
        lesson_id, title, content_data = row
        print(f"Lesson ID: {lesson_id}, Title: {title}")
        data = json.loads(content_data)
        tasks = data.get('tasks', [])
        print(f"Total tasks: {len(tasks)}")
        print()
        for t in tasks:
            tid = t.get('task_id') or t.get('id') or '?'
            ttype = t.get('type', '?')
            print(f"  [{tid}] type={ttype}")
            if ttype in ('match_pairs', 'MATCHING'):
                # Check all possible locations for pairs
                content_pairs = t.get('content', {}).get('pairs', [])
                data_pairs = t.get('data', {}).get('pairs', [])
                direct_pairs = t.get('pairs', [])
                print(f"    content.pairs count: {len(content_pairs)}")
                print(f"    data.pairs count: {len(data_pairs)}")
                print(f"    direct pairs count: {len(direct_pairs)}")
                print(f"    Full task: {json.dumps(t, indent=4)}")
