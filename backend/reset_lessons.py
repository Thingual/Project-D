"""
Reset ONLY the curriculum structure (units + lessons) so the new A1 curriculum re-seeds.

IMPORTANT: This script NEVER deletes user progress data:
  - user_lesson_completions  ← PRESERVED
  - flashcards               ← PRESERVED
  - velocity_logs            ← PRESERVED
  - lesson_history           ← PRESERVED

It only clears the curriculum tables so they can be re-seeded from JSON.
User progress is re-linked automatically since completions are matched by lesson slug/order.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Only remove curriculum structure — NEVER user progress
    db.execute(text("DELETE FROM lessons"))
    db.execute(text("DELETE FROM units"))
    db.commit()
    print("Done! Cleared curriculum (units + lessons only).")
    print("User progress (completions, flashcards, reviews) is PRESERVED.")
    print("Next dashboard load will re-seed the A1 curriculum!")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
