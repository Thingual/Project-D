import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv("DATABASE_URL")

engine = create_engine(db_url)
with engine.connect() as conn:
    result = conn.execute(text("SELECT id, content_data FROM lessons WHERE id=816"))
    row = result.fetchone()
    if row:
        import json
        data = json.loads(row[1])
        for t in data.get('tasks', []):
            if t.get('type') == 'MATCHING':
                print(json.dumps(t, indent=2))
    else:
        print("No lesson 816")
