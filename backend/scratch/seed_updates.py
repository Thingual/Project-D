from database import SessionLocal
from models import Unit, Lesson
from utils.lesson_generator import generate_personalized_units
import json

db = SessionLocal()

print("Re-seeding A1 Unit 5...")
a1_data = generate_personalized_units("A1")
u5_data = next((u for u in a1_data if u["order"] == 5), None)

if u5_data:
    u5_db = db.query(Unit).filter(Unit.level == "A1", Unit.order == 5).first()
    if u5_db:
        # Delete old lessons
        db.query(Lesson).filter(Lesson.unit_id == u5_db.id).delete()
        print(f"Deleted old lessons for Unit 5. Seeding {len(u5_data['lessons'])} lessons.")
        
        for l_data in u5_data["lessons"]:
            db.add(Lesson(
                unit_id=u5_db.id, title=l_data["title"],
                content_type=l_data["content_type"],
                content_data=json.dumps(l_data["content_data"]),
                order=l_data["order"]
            ))
        db.commit()
    else:
        print("Unit 5 not found in DB.")

print("Checking and seeding A2 units...")
a2_units_exist = db.query(Unit).filter(Unit.level == "A2").count() > 0
if not a2_units_exist:
    a2_data = generate_personalized_units("A2")
    for u_data in a2_data:
        new_unit = Unit(
            title=u_data["title"], description=u_data["description"],
            level="A2", order=u_data["order"], icon=u_data["icon"]
        )
        db.add(new_unit)
        db.flush()
        for l_data in u_data["lessons"]:
            db.add(Lesson(
                unit_id=new_unit.id, title=l_data["title"],
                content_type=l_data["content_type"],
                content_data=json.dumps(l_data["content_data"]),
                order=l_data["order"]
            ))
    db.commit()
    print("A2 units seeded successfully.")
else:
    print("A2 units already exist.")

print("Done.")
