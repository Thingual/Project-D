import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# We will use PostgreSQL. Make sure the DATABASE_URL is set in .env
# Example format: postgresql://username:password@localhost:5432/db_name
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/thingual")

engine_args = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

if DATABASE_URL.startswith("postgresql"):
    engine_args["connect_args"] = {
        "sslmode": "require",
        "connect_timeout": 10
    }

engine = create_engine(DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
