import sys, json
sys.path.insert(0, '.')
from database import SessionLocal
from models import Unit, Lesson
from utils.lesson_generator import generate_personalized_units

db = SessionLocal()

# Remove existing A2 units
a2_units = db.query(Unit).filter(Unit.level == 'A2').all()
print(f'Removing {len(a2_units)} existing A2 units...')
for u in a2_units:
    db.query(Lesson).filter(Lesson.unit_id == u.id).delete()
    db.delete(u)
db.commit()

# Reseed all 5 A2 units
a2_data = generate_personalized_units('A2')
print(f'Seeding {len(a2_data)} A2 units...')
for u_data in a2_data:
    new_unit = Unit(
        title=u_data['title'],
        description=u_data['description'],
        level='A2',
        order=u_data['order'],
        icon=u_data['icon']
    )
    db.add(new_unit)
    db.flush()
    lessons = u_data.get('lessons', [])
    for l_data in lessons:
        db.add(Lesson(
            unit_id=new_unit.id,
            title=l_data['title'],
            content_type=l_data['content_type'],
            content_data=json.dumps(l_data['content_data']),
            order=l_data['order']
        ))
    print(f"  Unit {u_data['order']}: {u_data['title']} ({len(lessons)} lessons)")
db.commit()
print('A2 reseed complete!')
db.close()
