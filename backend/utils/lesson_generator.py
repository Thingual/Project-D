import json, os
from typing import List, Dict, Any

def generate_personalized_units(level: str) -> List[Dict[str, Any]]:
    if level == "A1":
        return _get_a1_units()
    if level == "A2":
        return _get_a2_units()
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key: return _get_a1_units()
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"Generate English learning JSON for CEFR {level}. 5 units, 10 lessons each. Return valid JSON array only."
        response = model.generate_content(prompt)
        text = response.text.replace('```json','').replace('```','').strip()
        return json.loads(text)
    except Exception as e:
        print(f"Gemini failed: {e}. Using A1 fallback.")
        return _get_a1_units()

def _make(title, ctype, order, text, vocab=None, examples=None, questions=None, prompt=None, tip=None, keywords=None, model_answer=None, flashcards=None):
    d = {"text": text}
    if vocab: d["vocabulary"] = vocab
    if examples: d["examples"] = examples
    if questions: d["questions"] = questions
    if prompt: d["prompt"] = prompt
    if tip: d["tip"] = tip
    if keywords: d["keywords"] = keywords
    if model_answer: d["model_answer"] = model_answer
    if flashcards: d["flashcards"] = flashcards
    return {"title": title, "content_type": ctype, "order": order, "content_data": d}

def _v(w, d, ex): return {"word": w, "definition": d, "example": ex}
def _q(question, opts, ans): return {"question": question, "options": opts, "answer": ans}
def _fc(f, b): return {"front": f, "back": b}

def _get_a1_units():
    return [
        _unit1(), _unit2(), _unit3(), _unit4(), _unit5(), _unit6()
    ]

def _get_a2_units():
    return [
        _unit7(), _unit8(), _unit9(), _unit10(), _unit11(), _unit12()
    ]


def _build_unit_lessons_from_json(json_filename: str, unit_number: int) -> list:
    """Generic loader â€” handles both list format and {lessons: [...]} format."""
    json_path = os.path.join(os.path.dirname(__file__), json_filename)
    try:
        with open(json_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[lesson_generator] Could not load {json_filename}: {e}")
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
                    "unit_number": unit_number,
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



# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# UNIT 1 â€” First Steps in English (8 lessons from unit1_lessons.json)
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

def _convert_json_task(task: dict, lesson_id: str) -> list:
    """Convert a single unit1_lessons.json task into one or more frontend-compatible task dicts."""
    t = task.get("type", "")
    tid = task.get("id", "t")
    title = task.get("title", "")
    instruction = task.get("instruction", "")
    out = []

    if t in ("learn_card", "mcq", "scenario_mcq", "fill_blank", "sort_words", "match_pairs", "speaking", "listen_repeat", "error_correction", "family_tree", "lesson_summary", "dialogue"):
        # These are already in the "professional" new format — pass through
        # but ensure they have an id
        if "id" not in task and "task_id" in task:
            task["id"] = task["task_id"]
        return [task]

    if t == "learn_flashcard":
        cards = task.get("content", {}).get("cards", [])
        out.append({"id": f"{tid}_tip", "type": "LEARNING_TIP",
                    "data": {"title": title, "explanation": instruction or "Study these key words.",
                             "example": f"{cards[0]['front']} â€” {cards[0]['back']}" if cards else ""}})
        for i, card in enumerate(cards[:4]):
            out.append({"id": f"{tid}_fc{i}", "type": "FLASHCARD",
                        "data": {"primary_text": card.get("front", ""), "secondary_text": card.get("back", "")}})

    elif t == "learn_grammar":
        c = task.get("content", {})
        pattern = c.get("pattern", "")
        note = c.get("note", "")
        examples = c.get("examples", [])
        explanation = f"{pattern}. {note}".strip(". ") if pattern else note
        example_str = " | ".join(examples[:3])
        out.append({"id": tid, "type": "LEARNING_TIP",
                    "data": {"title": title, "explanation": explanation, "example": example_str}})

    elif t == "learn_dialogue":
        dialogue = task.get("dialogue", [])
        example_str = " | ".join([f"{d['speaker']}: {d['line']}" for d in dialogue[:4]])
        out.append({"id": tid, "type": "LEARNING_TIP",
                    "data": {"title": title, "explanation": instruction or "Read this conversation.", "example": example_str}})

    elif t == "multiple_choice":
        for q in task.get("questions", [])[:2]:
            opts = q.get("options", [])
            correct_val = q.get("correct", "")
            ci = opts.index(correct_val) if correct_val in opts else 0
            out.append({"id": q.get("id", tid), "type": "MULTIPLE_CHOICE",
                        "data": {"question": q.get("prompt", ""), "options": opts,
                                 "correct_index": ci, "explanation": q.get("explanation", "")}})

    elif t == "fill_in_blank":
        for q in task.get("questions", [])[:2]:
            sentence = q.get("sentence", "")
            answer = q.get("answer", "")
            out.append({"id": q.get("id", tid), "type": "TRANSLATE",
                        "data": {"source_text": sentence.replace("___", "___?"),
                                 "target_language": "English",
                                 "correct_variants": [answer]}})

    elif t == "reorder_sentence":
        for q in task.get("questions", [])[:2]:
            words = q.get("words", [])
            correct = q.get("correct", " ".join(words))
            out.append({"id": q.get("id", tid), "type": "SCRAMBLE",
                        "data": {"shuffled_words": words, "correct_sequence": correct}})

    elif t == "true_false":
        for q in task.get("questions", [])[:2]:
            statement = q.get("statement", "")
            answer = q.get("answer", True)
            ci = 0 if answer is True else 1
            out.append({"id": q.get("id", tid), "type": "MULTIPLE_CHOICE",
                        "data": {"question": statement, "options": ["True", "False"],
                                 "correct_index": ci, "explanation": q.get("explanation", "")}})

    elif t == "image_label":
        for q in task.get("questions", [])[:2]:
            opts = q.get("options", [])
            correct_val = q.get("correct", opts[0] if opts else "")
            ci = opts.index(correct_val) if correct_val in opts else 0
            out.append({"id": q.get("id", tid), "type": "MULTIPLE_CHOICE",
                        "data": {"question": q.get("image_description", q.get("context", title)),
                                 "options": opts, "correct_index": ci}})

    elif t in ("speaking_prompt", "speaking_roleplay"):
        chars = task.get("characters", [])
        prompts = task.get("prompts", [])
        if chars:
            script = chars[0].get("line", "")
        elif prompts:
            script = prompts[0] if isinstance(prompts, list) else str(prompts)
        else:
            script = task.get("prompt", instruction or "Speak naturally.")
        out.append({"id": tid, "type": "SPEAKING",
                    "data": {"script": script, "difficulty_threshold": 0.8}})

    elif t == "error_correction":
        for q in task.get("questions", [])[:2]:
            sentence = q.get("sentence", "")
            correction = q.get("corrected", q.get("correction", sentence))
            explanation = q.get("explanation", f"Correct: {correction}")
            out.append({"id": q.get("id", tid), "type": "ERROR_CORRECTION",
                        "data": {"sentence": sentence,
                                 "question": "Which is the correct version?",
                                 "options": [sentence, correction],
                                 "correct_index": 1,
                                 "explanation": explanation}})

    elif t == "vocabulary_select":
        for q in task.get("questions", [])[:2]:
            opts = q.get("options", [])
            correct_val = q.get("correct", "")
            ci = opts.index(correct_val) if correct_val in opts else 0
            out.append({"id": q.get("id", tid), "type": "MULTIPLE_CHOICE",
                        "data": {"question": q.get("description", ""), "options": opts, "correct_index": ci}})

    elif t == "dialogue_complete":
        for entry in task.get("dialogue", []):
            opts = entry.get("options")
            if opts:
                correct_val = entry.get("correct", opts[0])
                ci = opts.index(correct_val) if correct_val in opts else 0
                out.append({"id": tid, "type": "MULTIPLE_CHOICE",
                            "data": {"question": f"What is the best reply? ({title})",
                                     "options": opts, "correct_index": ci,
                                     "explanation": entry.get("explanation", "")}})
                break

    elif t in ("negative_form", "yes_no_questions"):
        c = task.get("content", {})
        note = c.get("note", "")
        if note:
            out.append({"id": f"{tid}_tip", "type": "LEARNING_TIP",
                        "data": {"title": title, "explanation": note, "example": ""}})
        for q in c.get("questions", [])[:2]:
            answer = q.get("answer", "")
            words = answer.split() if answer else []
            positive = q.get("positive", q.get("statement", ""))
            action_text = "Make it negative" if t == "negative_form" else "Make it a question"
            out.append({"id": q.get("id", tid), "type": "SENTENCE_BUILDER",
                        "data": {"prompt": f'{action_text}: "{positive}"',
                                 "options": words, "correct_answer": answer}})

    elif t == "writing":
        example = task.get("example_output", "")
        out.append({"id": tid, "type": "LISTENING",
                    "data": {"correct_answer": example,
                             "prompt": instruction}})

    elif t == "reading_comprehension":
        for q in task.get("questions", [])[:2]:
            out.append({"id": q.get("id", tid), "type": "TRANSLATE",
                        "data": {"source_text": q.get("question", ""),
                                 "target_language": "English",
                                 "correct_variants": [q.get("answer", "")]}})

    elif t == "unit_quiz":
        unit_label = f"Unit {lesson_id.split('_')[1].replace('unit', '')}" if '_' in lesson_id else "Unit 1"
        for q in task.get("questions", [])[:3]:
            opts = q.get("options", [])
            correct_val = q.get("correct", opts[0] if opts else "")
            ci = opts.index(correct_val) if correct_val in opts else 0
            out.append({"id": q.get("id", tid), "type": "REVIEW",
                        "data": {"origin": unit_label,
                                 "question": q.get("prompt", ""),
                                 "options": opts, "correct_index": ci}})

    elif t == "unit_completion":
        unit_label = f"Unit {lesson_id.split('_')[1].replace('unit', '')}" if '_' in lesson_id else "Unit 1"
        skills = task.get("skills_unlocked", [f"{unit_label} Complete!"])
        out.append({"id": tid, "type": "REVIEW",
                    "data": {"origin": unit_label,
                             "question": f"What have you mastered in {unit_label}?",
                             "options": skills[:4] if len(skills) >= 4 else skills + ["Keep going!"] * (4 - len(skills)),
                             "correct_index": 0}})

    return out


def _build_unit1_lessons_from_json() -> list:
    """Load unit1_lessons.json and convert to interactive lesson format."""
    json_path = os.path.join(os.path.dirname(__file__), "unit1_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[lesson_generator] Could not load unit1_lessons.json: {e}")
        return []

    lessons_json = data.get("unit", {}).get("lessons", [])
    result = []

    for lesson in lessons_json:
        lid = lesson.get("id", "L?")
        order = lesson.get("order", 1)
        title = lesson.get("title", "Lesson")
        description = lesson.get("description", "")
        all_tasks = []

        for task in lesson.get("tasks", []):
            converted = _convert_json_task(task, lid)
            all_tasks.extend(converted)

        # Assign sequential IDs
        for i, t in enumerate(all_tasks):
            t["id"] = i + 1

        result.append({
            "title": title,
            "content_type": "interactive",
            "order": order,
            "content_data": {
                "metadata": {
                    "lesson_id": f"A1_U1_{lid}",
                    "unit_number": 1,
                    "lesson_title": title,
                    "total_tasks": len(all_tasks)
                },
                "content_manifest": {
                    "vocabulary": [],
                    "grammar_point": description
                },
                "tasks": all_tasks
            }
        })

    return result


def _unit1():
    lessons = _build_unit1_lessons_from_json()
    return {
        "title": "First Steps in English",
        "description": "Greetings to Daily Life — master the core of everyday English.",
        "level": "A1", "order": 1, "icon": "👋",
        "lessons": lessons
    }


def _build_unit2_lessons_from_json() -> list:
    json_path = os.path.join(os.path.dirname(__file__), "unit2_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[lesson_generator] Could not load unit2_lessons.json: {e}")
        return []

    lessons_json = data.get("unit", {}).get("lessons", [])
    result = []

    for lesson in lessons_json:
        lid = lesson.get("lesson_id", lesson.get("id", "L?"))
        order = lesson.get("order", lesson.get("lesson_number", 1))
        title = lesson.get("title", "Lesson")
        description = lesson.get("description", "")
        all_tasks = lesson.get("tasks", [])

        # Assign sequential IDs if needed, but original JSON already has task_id.
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
                    "unit_number": 2,
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


def _unit2():
    lessons = _build_unit2_lessons_from_json()
    return {
        "title": "Food, Taste & Ordering",
        "description": "Learn vocabulary for food and drink, express preferences, and practise ordering politely.",
        "level": "A1", "order": 2, "icon": "🛒",
        "lessons": lessons
    }

# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# UNIT 3
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
def _build_unit3_lessons_from_json() -> list:
    json_path = os.path.join(os.path.dirname(__file__), "unit3_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[lesson_generator] Could not load unit3_lessons.json: {e}")
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

        # Assign sequential IDs if needed
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
                    "unit_number": 3,
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

def _unit3():
    lessons = _build_unit3_lessons_from_json()
    return {
        "title": "Daily Life & Surroundings",
        "description": "Talk about your body, clothes, feelings, and the home you live in.",
        "level": "A1", "order": 3, "icon": "🏠",
        "lessons": lessons
    }

# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# UNIT 4 — Food, Shopping & Likes
# -----------------------------------------------------------------------------
def _build_unit4_lessons_from_json() -> list:
    json_path = os.path.join(os.path.dirname(__file__), "unit4_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[lesson_generator] Could not load unit4_lessons.json: {e}")
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
                    "unit_number": 4,
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

def _unit4():
    lessons = _build_unit4_lessons_from_json()
    return {
        "title": "Food, Shopping & Likes",
        "description": "Order food, shop at the market, and express preferences.",
        "level": "A1", "order": 4, "icon": "🛒",
        "lessons": lessons
    }

# -----------------------------------------------------------------------------
# UNIT 5 — Family & Describing People
# -----------------------------------------------------------------------------
def _build_unit5_lessons_from_json() -> list:
    json_path = os.path.join(os.path.dirname(__file__), "unit5_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[lesson_generator] Could not load unit5_lessons.json: {e}")
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
                    "unit_number": 5,
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

def _unit5():
    lessons = _build_unit5_lessons_from_json()
    return {
        "title": "Family & Describing People",
        "description": "Talk about family members and describe people's appearance.",
        "level": "A1", "order": 5, "icon": "👨‍👩‍👧‍👦",
        "lessons": lessons
    }

# -----------------------------------------------------------------------------
# UNIT 6 — Daily Routine & Telling Time
# -----------------------------------------------------------------------------
def _build_unit6_lessons_from_json() -> list:
    json_path = os.path.join(os.path.dirname(__file__), "unit6_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[lesson_generator] Could not load unit6_lessons.json: {e}")
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
                    "unit_number": 6,
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

def _unit6():
    lessons = _build_unit6_lessons_from_json()
    return {
        "title": "Daily Routine & Telling Time",
        "description": "Learn to talk about your daily habits.",
        "level": "A1", "order": 6, "icon": "⏰",
        "lessons": lessons
    }

# -----------------------------------------------------------------------------
# UNIT 7 
# -----------------------------------------------------------------------------
def _build_unit7_lessons_from_json() -> list:
    json_path = os.path.join(os.path.dirname(__file__), "unit7_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8-sig") as f:
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

# -----------------------------------------------------------------------------
# UNIT 8 
# -----------------------------------------------------------------------------
def _build_unit8_lessons_from_json() -> list:
    json_path = os.path.join(os.path.dirname(__file__), "unit8_lessons.json")
    try:
        with open(json_path, "r", encoding="utf-8-sig") as f:
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


# -----------------------------------------------------------------------------
# UNIT 9 — Present Perfect & Past Simple
# -----------------------------------------------------------------------------
def _unit9():
    lessons = _build_unit_lessons_from_json("unit9_lessons.json", 9)
    return {
        "title": "Present Perfect & Past Simple",
        "description": "Understand when to use the present perfect vs past simple in everyday English.",
        "level": "A2", "order": 3, "icon": "🕰️",
        "lessons": lessons
    }
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
def _unit10():
    lessons = _build_unit_lessons_from_json("unit10_lessons.json", 10)
    return {
        "title": "Future, Plans & Communication",
        "description": "Talk about the future, make plans, write formal emails and give directions.",
        "level": "A2", "order": 4, "icon": "📅",
        "lessons": lessons
    }


# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
# UNIT 11 â€” Everyday English in Real Life
# â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
def _unit11():
    lessons = _build_unit_lessons_from_json("unit11_lessons.json", 11)
    return {
        "title": "Everyday English in Real Life",
        "description": "Master question tags, polite requests, phone English, small talk and expressing opinions.",
        "level": "A2", "order": 5, "icon": "💬",
        "lessons": lessons
    }


# ─────────────────────────────────────────────────────────────────────────────
# UNIT 12 — Present Perfect / Life Experiences
# ─────────────────────────────────────────────────────────────────────────────
def _unit12():
    lessons = _build_unit_lessons_from_json("unit12_lessons.json", 12)
    return {
        "title": "Present Perfect / Life Experiences",
        "description": "Master life experiences using the present perfect tense with ever, never, already, yet, just, and still.",
        "level": "A2", "order": 6, "icon": "🎓",
        "lessons": lessons
    }

