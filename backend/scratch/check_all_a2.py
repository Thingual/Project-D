import sqlite3
import json

conn = sqlite3.connect('backend/thingual.db')
c = conn.cursor()
c.execute("SELECT id, title, content_data FROM lessons WHERE id >= 49") # Lessons 49+ are A2/Unit 7+
rows = c.fetchall()

task_types = {}
for row in rows:
    lesson_id, title, content_data = row
    try:
        data = json.loads(content_data)
        tasks = data.get("tasks", [])
        for t in tasks:
            t_type = t.get("type")
            content = t.get("content", {})
            task_types.setdefault(t_type, []).append((lesson_id, title, t))
    except Exception as e:
        print(f"Error parsing lesson {lesson_id}: {e}")

print("A2 Task Types stats:")
for t_type, instances in task_types.items():
    print(f"\nType: {t_type} ({len(instances)} instances)")
    
    # Check what keys are present in content
    keys_freq = {}
    for lid, ltitle, inst in instances[:10]: # inspect first 10 instances
        content = inst.get("content", {})
        for k in content.keys():
            keys_freq[k] = keys_freq.get(k, 0) + 1
    print("  Content keys in sample:", keys_freq)

    # Check if there is an explanation or potential explanation fields (like context, hint, rule, note)
    has_exp = 0
    has_context = 0
    has_note = 0
    has_hint = 0
    for lid, ltitle, inst in instances:
        content = inst.get("content", {})
        if "explanation" in content or "explanation" in inst:
            has_exp += 1
        if "context" in content:
            has_context += 1
        if "note" in content:
            has_note += 1
        if "hint" in content:
            has_hint += 1
            
        # Check items in array tasks
        items = content.get("items", []) or content.get("sentences", [])
        if isinstance(items, list) and len(items) > 0 and isinstance(items[0], dict):
            if any("explanation" in it for it in items):
                has_exp += 1
            if any("context" in it for it in items):
                has_context += 1
            if any("hint" in it for it in items):
                has_hint += 1
                
    print(f"  Total instances: {len(instances)}")
    print(f"  Has explanation: {has_exp}")
    print(f"  Has context: {has_context}")
    print(f"  Has note: {has_note}")
    print(f"  Has hint: {has_hint}")
conn.close()
