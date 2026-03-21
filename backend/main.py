"""
Thingual FastAPI Backend
Shared auth API — used by the web frontend (React+Vite) and mobile app.
"""
import os
import logging
import traceback
from dotenv import load_dotenv

# Load env vars FIRST before importing any other modules
load_dotenv()

import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from sqlalchemy.exc import OperationalError
from database import engine, SessionLocal, Base
from models import User
from routers import auth, onboarding

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# REMOVED from top-level: Base.metadata.create_all(bind=engine)

app = FastAPI(title="Thingual API", version="1.0.0")

# ── CORS — must be added FIRST before anything else ─────────────
# This handles browser preflight OPTIONS requests
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ─────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    # Retry database connection (Neon cold start fix)
    retries = 5
    while retries > 0:
        try:
            logger.info(f"Connecting to database... ({6 - retries}/5)")
            Base.metadata.create_all(bind=engine)
            logger.info("Database connected and tables verified.")
            break
        except Exception as e:
            retries -= 1
            if retries == 0:
                logger.error("Could not connect to database after 5 attempts.")
                raise e
            logger.warning(f"Database connection failed. Retrying in 3 seconds... Error: {e}")
            time.sleep(3)

    db = SessionLocal()
    try:
        test_user = db.query(User).filter(User.id == 1).first()
        if not test_user:
            test_user = User(
                id=1,
                name="Test User",
                email="test@thingual.com",
                password_hash=pwd_context.hash("Test@1234")
            )
            db.add(test_user)
            db.commit()
        elif not test_user.password_hash or not test_user.password_hash.startswith("$2"):
            # Fix invalid password hash from earlier seeds
            test_user.password_hash = pwd_context.hash("Test@1234")
            db.commit()
    finally:
        db.close()

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global error: {exc}")
    logger.error(traceback.format_exc())
    return {
        "detail": str(exc),
        "traceback": traceback.format_exc() if os.getenv("DEBUG") == "True" else None
    }

# ── Routers ──────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "thingual-api"}

@app.get("/")
def read_root():
    return {"message": "Welcome to the Thingual API!"}
