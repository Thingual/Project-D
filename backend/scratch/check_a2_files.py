import json

# Check backend unit7_lessons.json
data = json.load(open('utils/unit7_lessons.json', encoding='utf-8'))
if isinstance(data, list):
    print(f'Backend unit7: {len(data)} lessons')
    for l in data:
        lid = l.get('lesson_id', l.get('id', '?'))
        tasks = len(l.get('tasks', []))
        print(f'  - {lid}  tasks={tasks}')
else:
    print('dict:', list(data.keys()))

print()
# Check frontend Unit-7 files
import os, glob
fe_files = sorted(glob.glob('../frontend/public/A2/Unit-7/*.json'))
print(f'Frontend Unit-7: {len(fe_files)} files')
for f in fe_files:
    d = json.load(open(f, encoding='utf-8'))
    print(f'  - {os.path.basename(f)}  lesson_id={d.get("lesson_id","?")}  tasks={len(d.get("tasks",[]))}')

print()
fe_files8 = sorted(glob.glob('../frontend/public/A2/unit-8/*.json'))
print(f'Frontend unit-8: {len(fe_files8)} files')
for f in fe_files8:
    d = json.load(open(f, encoding='utf-8'))
    print(f'  - {os.path.basename(f)}  lesson_id={d.get("lesson_id","?")}  tasks={len(d.get("tasks",[]))}')
