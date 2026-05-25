import glob
import json
import os
from collections import Counter

fe_files = glob.glob("../frontend/public/A2/**/*.json", recursive=True)
print(f"Found {len(fe_files)} JSON files in frontend/public/A2/")

task_types = Counter()
type_structures = {}

def process_task(task, filename):
    t_type = task.get("type")
    if not t_type:
        return
    task_types[t_type] += 1
    
    has_items = "items" in task
    items_len = len(task.get("items", [])) if has_items else 0
    has_content = "content" in task
    content_keys = list(task.get("content", {}).keys()) if has_content else []
    
    keys = list(task.keys())
    
    if t_type not in type_structures:
        type_structures[t_type] = []
        
    type_structures[t_type].append({
        "file": filename,
        "task_id": task.get("task_id"),
        "keys": keys,
        "has_items": has_items,
        "items_len": items_len,
        "content_keys": content_keys,
    })

for path in fe_files:
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
            
            # Handle list at root level (multiple lessons in one file)
            if isinstance(data, list):
                for lesson in data:
                    tasks = lesson.get("tasks", [])
                    for task in tasks:
                        process_task(task, os.path.basename(path))
            else:
                tasks = data.get("tasks", [])
                for task in tasks:
                    process_task(task, os.path.basename(path))
    except Exception as e:
        print(f"Error reading {path}: {e}")

print("\n--- Task Type Counts ---")
for t, count in task_types.items():
    print(f"{t}: {count}")

print("\n--- Samples for each Task Type ---")
for t_type, samples in type_structures.items():
    print(f"\nType: {t_type}")
    seen_structs = set()
    for s in samples:
        struct_summary = f"keys={sorted(s['keys'])} has_items={s['has_items']} (len={s['items_len']}) content_keys={sorted(s['content_keys'])}"
        if struct_summary not in seen_structs:
            seen_structs.add(struct_summary)
            print(f"  - Sample from {s['file']} (ID: {s['task_id']}):")
            print(f"    Keys: {s['keys']}")
            if s['has_items']:
                print(f"    items count: {s['items_len']}")
            if s['content_keys']:
                print(f"    content keys: {s['content_keys']}")
