import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import SessionLocal
from models import Unit, Lesson
from utils.lesson_generator import generate_personalized_units
import json

db = SessionLocal()
try:
    print("Checking A1 units...")
    a1_units_exist = db.query(Unit).filter(Unit.level == "A1").count() > 0
    if not a1_units_exist:
        print("Seeding A1 curriculum...")
        a1_data = generate_personalized_units("A1")
        for u_data in a1_data:
            new_unit = Unit(
                title=u_data["title"], description=u_data["description"],
                level="A1", order=u_data["order"], icon=u_data["icon"]
            )
            db.add(new_unit)
            db.flush()
            print(f"  Added Unit {u_data['order']}: {u_data['title']}")
            for l_data in u_data["lessons"]:
                db.add(Lesson(
                    unit_id=new_unit.id, title=l_data["title"],
                    content_type=l_data["content_type"],
                    content_data=json.dumps(l_data["content_data"]),
                    order=l_data["order"]
                ))
        db.commit()
        print("A1 Seeding completed successfully!")
    else:
        print("A1 units already exist.")

    print("Checking A2 units...")
    a2_units_exist = db.query(Unit).filter(Unit.level == "A2").count() > 0
    if not a2_units_exist:
        print("Seeding A2 curriculum...")
        a2_data = generate_personalized_units("A2")
        for u_data in a2_data:
            new_unit = Unit(
                title=u_data["title"], description=u_data["description"],
                level="A2", order=u_data["order"], icon=u_data["icon"]
            )
            db.add(new_unit)
            db.flush()
            print(f"  Added Unit {u_data['order']}: {u_data['title']}")
            for l_data in u_data["lessons"]:
                db.add(Lesson(
                    unit_id=new_unit.id, title=l_data["title"],
                    content_type=l_data["content_type"],
                    content_data=json.dumps(l_data["content_data"]),
                    order=l_data["order"]
                ))
        db.commit()
        print("A2 Seeding completed successfully!")
    else:
        print("A2 units already exist.")

    # Let's count them
    units = db.query(Unit).order_by(Unit.level, Unit.order).all()
    print("Database State - Units in DB:")
    for u in units:
        lessons_count = db.query(Lesson).filter(Lesson.unit_id == u.id).count()
        print(f"  Level: {u.level}, Unit {u.order} (ID: {u.id}): {u.title} - Lessons count: {lessons_count}")

except Exception as e:
    db.rollback()
    print(f"Error seeding: {e}")
finally:
    db.close()
