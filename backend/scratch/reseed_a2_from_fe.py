"""
Re-seed A2 units from the frontend public JSON files (canonical source).
Unit 7: 7 lessons from /frontend/public/A2/Unit-7/
Unit 8: 8 lessons from /frontend/public/A2/unit-8/
"""
import json, glob, os, sys
sys.path.insert(0, '.')

from database import SessionLocal
from models import Unit, Lesson

db = SessionLocal()

def build_lessons_from_fe(fe_dir: str, unit_number: int) -> list:
    files = sorted(glob.glob(os.path.join(fe_dir, '*.json')))
    result = []
    for f in files:
        d = json.load(open(f, encoding='utf-8'))
        lid = d.get('lesson_id', os.path.basename(f).replace('.json', ''))
        order = d.get('lesson_number', len(result) + 1)
        title = d.get('title', 'Lesson')
        description = d.get('description', '')
        tasks = d.get('tasks', [])

        result.append({
            'title': title,
            'content_type': 'interactive',
            'order': order,
            'content_data': json.dumps({
                'metadata': {
                    'lesson_id': lid,
                    'unit_number': unit_number,
                    'lesson_title': title,
                    'total_tasks': len(tasks)
                },
                'content_manifest': {
                    'vocabulary': [],
                    'grammar_point': description
                },
                'tasks': tasks
            })
        })
    return result


FE_BASE = os.path.join('..', 'frontend', 'public', 'A2')

# ── Unit 7 ───────────────────────────────────────────────────────────────────
u7_fe_dir = os.path.join(FE_BASE, 'Unit-7')
u7_lessons = build_lessons_from_fe(u7_fe_dir, 7)
print(f'Unit 7: {len(u7_lessons)} lessons from frontend')

u7_db = db.query(Unit).filter(Unit.level == 'A2', Unit.order == 1).first()
if u7_db:
    old = db.query(Lesson).filter(Lesson.unit_id == u7_db.id).delete()
    print(f'  Deleted {old} old lessons')
    for l in u7_lessons:
        db.add(Lesson(
            unit_id=u7_db.id,
            title=l['title'],
            content_type=l['content_type'],
            content_data=l['content_data'],
            order=l['order']
        ))
    db.commit()
    print(f'  Seeded {len(u7_lessons)} lessons for Unit 7 OK')
else:
    print('  ERROR: Unit 7 not found in DB!')

# ── Unit 8 ───────────────────────────────────────────────────────────────────
u8_fe_dir = os.path.join(FE_BASE, 'unit-8')
u8_lessons = build_lessons_from_fe(u8_fe_dir, 8)
print(f'Unit 8: {len(u8_lessons)} lessons from frontend')

u8_db = db.query(Unit).filter(Unit.level == 'A2', Unit.order == 2).first()
if u8_db:
    old = db.query(Lesson).filter(Lesson.unit_id == u8_db.id).delete()
    print(f'  Deleted {old} old lessons')
    for l in u8_lessons:
        db.add(Lesson(
            unit_id=u8_db.id,
            title=l['title'],
            content_type=l['content_type'],
            content_data=l['content_data'],
            order=l['order']
        ))
    db.commit()
    print(f'  Seeded {len(u8_lessons)} lessons for Unit 8 OK')
else:
    print('  ERROR: Unit 8 not found in DB!')

# ── Verify ───────────────────────────────────────────────────────────────────
print()
print('Final DB state (A2):')
a2_units = db.query(Unit).filter(Unit.level == 'A2').order_by(Unit.order).all()
for u in a2_units:
    cnt = db.query(Lesson).filter(Lesson.unit_id == u.id).count()
    print(f'  Level=A2 Order={u.order} Title={u.title} Lessons={cnt}')

db.close()
print('Done.')
