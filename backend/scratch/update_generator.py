import re

with open('utils/lesson_generator.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace all occurrences
pattern = r'    if "lessons" in data:\s+lessons_json = data\["lessons"\]\s+elif "unit" in data and isinstance\(data\["unit"\], dict\):\s+lessons_json = data\["unit"\].get\("lessons", \[\]\)\s+else:\s+lessons_json = \[\]'

replacement = """    if isinstance(data, list):
        lessons_json = data
    elif "lessons" in data:
        lessons_json = data["lessons"]
    elif "unit" in data and isinstance(data["unit"], dict):
        lessons_json = data["unit"].get("lessons", [])
    else:
        lessons_json = []"""

text = re.sub(pattern, replacement, text)

# Add _get_a2_units, _unit7, _unit8 if not present
if "def _get_a2_units():" not in text:
    # Update generate_personalized_units
    text = re.sub(
        r'def generate_personalized_units\(level: str\) -> List\[Dict\[str, Any\]\]:\n    if level == "A1":\n        return _get_a1_units\(\)',
        'def generate_personalized_units(level: str) -> List[Dict[str, Any]]:\n    if level == "A1":\n        return _get_a1_units()\n    if level == "A2":\n        return _get_a2_units()',
        text
    )

    # Add the function
    text = text.replace('def _get_a1_units():\n    return [\n        _unit1(), _unit2(), _unit3(), _unit4(), _unit5(), _unit6()\n    ]', 'def _get_a1_units():\n    return [\n        _unit1(), _unit2(), _unit3(), _unit4(), _unit5(), _unit6()\n    ]\n\ndef _get_a2_units():\n    return [\n        _unit7(), _unit8()\n    ]')

    # Append unit7 and unit8 loaders
    loaders = """
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# UNIT 7 
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _build_unit7_lessons_from_json() -> list:
    json_path = os.path.join(os.path.dirname(__file__), "unit7_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[lesson_generator] Could not load unit7_lessons.json: {e}")
        return []

    if isinstance(data, list):
        lessons_json = data
    elif "lessons" in data:
        lessons_json = data["lessons"]
    elif "unit" in data and isinstance(data["unit"], dict):
        lessons_json = data["unit"].get("lessons", [])
    else:
        lessons_json = []

    result = []
    for lesson in lessons_json:
        lid = lesson.get("lesson_id", lesson.get("id", "L?"))
        order = lesson.get("order", lesson.get("lesson_number", 1))
        title = lesson.get("title", "Lesson")
        description = lesson.get("description", "")
        all_tasks = lesson.get("tasks", [])

        for i, t in enumerate(all_tasks):
            if "id" not in t:
                t["id"] = t.get("task_id", i + 1)

        converted_tasks = []
        for t in all_tasks:
            converted_tasks.extend(_convert_json_task(t, lid))

        result.append({
            "title": title,
            "content_type": "interactive",
            "order": order,
            "content_data": {
                "metadata": {
                    "lesson_id": lid,
                    "unit_number": 7,
                    "lesson_title": title,
                    "total_tasks": len(converted_tasks)
                },
                "content_manifest": {
                    "vocabulary": [],
                    "grammar_point": description
                },
                "tasks": converted_tasks
            }
        })
    return result

def _unit7():
    lessons = _build_unit7_lessons_from_json()
    return {
        "title": "Obligations, rules & advice",
        "description": "Learn to talk about rules, obligations, and giving advice.",
        "level": "A2", "order": 1, "icon": "📜",
        "lessons": lessons
    }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# UNIT 8 
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _build_unit8_lessons_from_json() -> list:
    json_path = os.path.join(os.path.dirname(__file__), "unit8_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[lesson_generator] Could not load unit8_lessons.json: {e}")
        return []

    if isinstance(data, list):
        lessons_json = data
    elif "lessons" in data:
        lessons_json = data["lessons"]
    elif "unit" in data and isinstance(data["unit"], dict):
        lessons_json = data["unit"].get("lessons", [])
    else:
        lessons_json = []

    result = []
    for lesson in lessons_json:
        lid = lesson.get("lesson_id", lesson.get("id", "L?"))
        order = lesson.get("order", lesson.get("lesson_number", 1))
        title = lesson.get("title", "Lesson")
        description = lesson.get("description", "")
        all_tasks = lesson.get("tasks", [])

        for i, t in enumerate(all_tasks):
            if "id" not in t:
                t["id"] = t.get("task_id", i + 1)

        converted_tasks = []
        for t in all_tasks:
            converted_tasks.extend(_convert_json_task(t, lid))

        result.append({
            "title": title,
            "content_type": "interactive",
            "order": order,
            "content_data": {
                "metadata": {
                    "lesson_id": lid,
                    "unit_number": 8,
                    "lesson_title": title,
                    "total_tasks": len(converted_tasks)
                },
                "content_manifest": {
                    "vocabulary": [],
                    "grammar_point": description
                },
                "tasks": converted_tasks
            }
        })
    return result

def _unit8():
    lessons = _build_unit8_lessons_from_json()
    return {
        "title": "Much Better, Far Cheaper",
        "description": "Learn to make comparatives stronger and more expressive.",
        "level": "A2", "order": 2, "icon": "⚖️",
        "lessons": lessons
    }
"""
    text += loaders

with open('utils/lesson_generator.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated successfully")
