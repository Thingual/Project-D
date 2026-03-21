from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_type = Column(String) # grammar, sentence_correction, listening, vocabulary, picture_description
    question_id = Column(Integer)
    user_answer = Column(String, nullable=True) # For MCQ
    speech_text = Column(Text, nullable=True) # Text from Whisper
    score = Column(Float)
    response_time = Column(Float, nullable=True) # In seconds

class UserLevel(Base):
    __tablename__ = "user_levels"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    level = Column(String) # A1, A2, B1, B2
    score = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
