import os
import datetime
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# We will run completion on both SQLite and Neon DBs to be absolutely sure.
db_configs = [
    {
        "name": "Local SQLite (thingual.db)",
        "engine": create_engine("sqlite:///./thingual.db"),
        "user_ids": [2, 14]
    },
    {
        "name": "Remote Neon Database",
        "engine": create_engine("postgresql://neondb_owner:npg_VDh1O5cTSlau@ep-dry-sound-a1rwnia5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=10"),
        "user_ids": [2, 14]
    }
]

for db in db_configs:
    print(f"\nProcessing {db['name']}...")
    try:
        engine = db["engine"]
        with engine.connect() as conn:
            # Get all A1 lesson IDs
            a1_lessons = conn.execute(text("""
                SELECT l.id 
                FROM lessons l
                JOIN units u ON l.unit_id = u.id
                WHERE u.level = 'A1'
            """)).fetchall()
            a1_lesson_ids = [row[0] for row in a1_lessons]
            print(f"  Found {len(a1_lesson_ids)} A1 lessons.")
            
            if not a1_lesson_ids:
                print("  No A1 lessons found. Skipping.")
                continue

            for uid in db["user_ids"]:
                # Check if user exists
                user_exists = conn.execute(text("SELECT id FROM users WHERE id = :u"), {"u": uid}).fetchone()
                if not user_exists:
                    print(f"  User ID {uid} does not exist in this database. Skipping.")
                    continue
                
                print(f"  Updating completions for user {uid}...")
                
                # Check already completed lessons for this user
                completed = conn.execute(text("""
                    SELECT lesson_id FROM user_lesson_completions WHERE user_id = :u
                """), {"u": uid}).fetchall()
                completed_ids = {row[0] for row in completed}
                
                added_count = 0
                for lid in a1_lesson_ids:
                    if lid not in completed_ids:
                        conn.execute(text("""
                            INSERT INTO user_lesson_completions (user_id, lesson_id, completed_at)
                            VALUES (:uid, :lid, :completed_at)
                        """), {
                            "uid": uid,
                            "lid": lid,
                            "completed_at": datetime.datetime.now(datetime.timezone.utc)
                        })
                        added_count += 1
                
                print(f"    Added {added_count} new completion records (already had {len(completed_ids)}).")
                
                # Update user levels table to A2
                existing_level = conn.execute(text("""
                    SELECT id FROM user_levels WHERE user_id = :uid
                """), {"uid": uid}).fetchone()
                
                if existing_level:
                    conn.execute(text("""
                        UPDATE user_levels 
                        SET level = 'A2', score = 1.0, created_at = :now
                        WHERE user_id = :uid
                    """), {
                        "uid": uid,
                        "now": datetime.datetime.now(datetime.timezone.utc)
                    })
                    print("    Updated existing user_levels record to A2.")
                else:
                    conn.execute(text("""
                        INSERT INTO user_levels (user_id, level, score, created_at)
                        VALUES (:uid, 'A2', 1.0, :now)
                    """), {
                        "uid": uid,
                        "now": datetime.datetime.now(datetime.timezone.utc)
                    })
                    print("    Inserted new user_levels record for A2.")
            
            # Commit the transaction (SQLAlchemy connects in autocommit for sqlite, but needs commit in postgres depending on engine configuration)
            conn.execute(text("COMMIT"))
            print("  Changes committed successfully.")
            
    except Exception as e:
        print(f"  Error updating {db['name']}: {e}")
