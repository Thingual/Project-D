import os
import jwt
import time
from fastapi.testclient import TestClient
from dotenv import load_dotenv

load_dotenv()

# We need to test the actual endpoint. Let's import the FastAPI app.
from main import app
from database import SessionLocal
from sqlalchemy import text

# Configure TestClient
client = TestClient(app)

JWT_SECRET = os.getenv("JWT_SECRET", "thingual_jwt_secret_change_in_production")
JWT_ALGO = os.getenv("JWT_ALGORITHM", "HS256")

def generate_token(user_id: int, email: str, name: str):
    data = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "exp": time.time() + 3600
    }
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGO)

# Test 1: SQLite
print("=== Testing SQLite Backend Endpoint ===")
# Ensure SQLite is active in the current database SessionLocal
db = SessionLocal()
try:
    # Check if user 2 exists
    user2 = db.execute(text("SELECT id, name, email FROM users WHERE id=2")).fetchone()
    if user2:
        token = generate_token(2, user2[2], user2[1])
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/lessons/dashboard", headers=headers)
        print("Response Status:", response.status_code)
        if response.status_code == 200:
            data = response.json()
            print("Current Level returned:", data.get("current_level"))
            print("Total Units returned:", len(data.get("units", [])))
            for u in data.get("units", []):
                completed = sum(1 for l in u.get("lessons", []) if l.get("is_completed"))
                total = len(u.get("lessons", []))
                print(f"  Unit {u.get('order')} ({u.get('level')}): {completed}/{total} lessons completed")
        else:
            print("Error response:", response.text)
    else:
        print("User 2 not found in SQLite.")
finally:
    db.close()

# Test 2: Neon
print("\n=== Testing Neon Backend Endpoint ===")
# Reconfigure database URL to Neon for this thread/test
os.environ["DATABASE_URL"] = "postgresql://neondb_owner:npg_VDh1O5cTSlau@ep-dry-sound-a1rwnia5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=10"
# Recreate database engine connection
from sqlalchemy import create_engine
import database
database.engine = create_engine(os.environ["DATABASE_URL"])
database.SessionLocal.configure(bind=database.engine)

db = SessionLocal()
try:
    user14 = db.execute(text("SELECT id, name, email FROM users WHERE id=14")).fetchone()
    if user14:
        token = generate_token(14, user14[2], user14[1])
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/lessons/dashboard", headers=headers)
        print("Response Status:", response.status_code)
        if response.status_code == 200:
            data = response.json()
            print("Current Level returned:", data.get("current_level"))
            print("Total Units returned:", len(data.get("units", [])))
            for u in data.get("units", []):
                completed = sum(1 for l in u.get("lessons", []) if l.get("is_completed"))
                total = len(u.get("lessons", []))
                print(f"  Unit {u.get('order')} ({u.get('level')}): {completed}/{total} lessons completed")
        else:
            print("Error response:", response.text)
    else:
        print("User 14 not found in Neon.")
finally:
    db.close()
