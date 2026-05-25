import json
import os

def create_task(t_id, order, t_type, cat, title, content):
    return {
        "task_id": t_id,
        "order": order,
        "type": t_type,
        "category": cat,
        "title": title,
        "content": content
    }

lessons_data = [
    # Lesson 1
    {
        "title": "Morning Routine: Waking Up",
        "description": "Learn the very first actions of the day.",
        "vocab": [
            ("wake up", "open eyes after sleeping"),
            ("get up", "leave the bed"),
            ("wash my face", "clean face with water"),
            ("brush my teeth", "clean teeth")
        ],
        "mcq": {
            "question": "I always ___ my teeth in the morning.",
            "options": ["brush", "wash", "wake", "get"],
            "correct_index": 0,
            "explanation": "You 'brush' your teeth."
        },
        "fill": {
            "sentence": "I ___ up early and ___ my face.",
            "blanks": [
                {"position": 1, "options": ["wake", "woke", "wakes"], "correct": "wake"},
                {"position": 2, "options": ["wash", "washes", "washed"], "correct": "wash"}
            ]
        },
        "sort": ["I", "always", "wake", "up", "early", "today"]
    },
    # Lesson 2
    {
        "title": "Morning Routine: Breakfast",
        "description": "Getting dressed and eating breakfast.",
        "vocab": [
            ("get dressed", "put on clothes"),
            ("have breakfast", "eat the morning meal"),
            ("drink coffee", "drink a hot beverage"),
            ("make tea", "prepare tea")
        ],
        "mcq": {
            "question": "I ___ breakfast at 7 AM.",
            "options": ["have", "do", "go", "get"],
            "correct_index": 0,
            "explanation": "We say 'have breakfast' or 'eat breakfast'."
        },
        "fill": {
            "sentence": "She ___ dressed and ___ coffee.",
            "blanks": [
                {"position": 1, "options": ["gets", "get", "got"], "correct": "gets"},
                {"position": 2, "options": ["drinks", "drink", "drank"], "correct": "drinks"}
            ]
        },
        "sort": ["I", "usually", "have", "breakfast", "at", "home"]
    },
    # Lesson 3
    {
        "title": "Telling Time: O'clock",
        "description": "Learn how to say the exact hour.",
        "vocab": [
            ("o'clock", "used to specify the hour"),
            ("what time is it?", "asking for the time"),
            ("it is 8 o'clock", "saying it is exactly 8:00"),
            ("at", "preposition used before time")
        ],
        "mcq": {
            "question": "___ time is it?",
            "options": ["What", "When", "How", "Who"],
            "correct_index": 0,
            "explanation": "We ask 'What time is it?'"
        },
        "fill": {
            "sentence": "It is exactly nine ___.",
            "blanks": [
                {"position": 1, "options": ["o'clock", "clock", "time"], "correct": "o'clock"}
            ]
        },
        "sort": ["I", "start", "work", "at", "nine", "o'clock"]
    },
    # Lesson 4
    {
        "title": "Telling Time: Half & Quarter",
        "description": "Learn to talk about minutes past the hour.",
        "vocab": [
            ("half past", "30 minutes past the hour"),
            ("quarter past", "15 minutes past the hour"),
            ("quarter to", "15 minutes before the next hour"),
            ("noon", "12 PM")
        ],
        "mcq": {
            "question": "It is half ___ five (5:30).",
            "options": ["past", "pass", "to", "after"],
            "correct_index": 0,
            "explanation": "We say 'half past'."
        },
        "fill": {
            "sentence": "The train leaves at a quarter ___ two.",
            "blanks": [
                {"position": 1, "options": ["to", "at", "for"], "correct": "to"}
            ]
        },
        "sort": ["It", "is", "a", "quarter", "past", "three"]
    },
    # Lesson 5
    {
        "title": "Going to Work or School",
        "description": "Learn verbs for commuting and starting the day's tasks.",
        "vocab": [
            ("go to work", "travel to your job"),
            ("take the bus", "use public transport"),
            ("drive", "operate a car"),
            ("start work", "begin your job")
        ],
        "mcq": {
            "question": "I ___ the bus to school every day.",
            "options": ["take", "go", "drive", "make"],
            "correct_index": 0,
            "explanation": "You 'take' the bus."
        },
        "fill": {
            "sentence": "I ___ to work and ___ at 9 AM.",
            "blanks": [
                {"position": 1, "options": ["drive", "drives", "take"], "correct": "drive"},
                {"position": 2, "options": ["start", "starts", "go"], "correct": "start"}
            ]
        },
        "sort": ["She", "takes", "the", "bus", "to", "school"]
    },
    # Lesson 6
    {
        "title": "Afternoon Routine",
        "description": "Actions in the middle of the day.",
        "vocab": [
            ("have lunch", "eat the midday meal"),
            ("finish work", "complete your job for the day"),
            ("go home", "return to your house"),
            ("afternoon", "time between noon and evening")
        ],
        "mcq": {
            "question": "We have ___ at 1 PM.",
            "options": ["lunch", "breakfast", "dinner", "supper"],
            "correct_index": 0,
            "explanation": "Lunch is the midday meal."
        },
        "fill": {
            "sentence": "I ___ work at 5 PM and go ___.",
            "blanks": [
                {"position": 1, "options": ["finish", "start", "do"], "correct": "finish"},
                {"position": 2, "options": ["home", "to home", "house"], "correct": "home"}
            ]
        },
        "sort": ["I", "always", "go", "home", "after", "work"]
    },
    # Lesson 7
    {
        "title": "Evening Routine & Hobbies",
        "description": "What to do after getting home.",
        "vocab": [
            ("have dinner", "eat the evening meal"),
            ("cook", "prepare food"),
            ("watch TV", "look at television programs"),
            ("read a book", "look at words in a book")
        ],
        "mcq": {
            "question": "In the evening, I like to ___ a book.",
            "options": ["read", "watch", "see", "look"],
            "correct_index": 0,
            "explanation": "You 'read' a book."
        },
        "fill": {
            "sentence": "My dad ___ dinner and we ___ TV.",
            "blanks": [
                {"position": 1, "options": ["cooks", "cook", "make"], "correct": "cooks"},
                {"position": 2, "options": ["watch", "see", "look"], "correct": "watch"}
            ]
        },
        "sort": ["We", "have", "dinner", "at", "seven", "o'clock"]
    },
    # Lesson 8
    {
        "title": "Night Routine",
        "description": "Getting ready for sleep.",
        "vocab": [
            ("take a shower", "wash your body"),
            ("go to bed", "get into bed to sleep"),
            ("sleep", "rest with eyes closed"),
            ("night", "time when it is dark")
        ],
        "mcq": {
            "question": "I always ___ a shower before bed.",
            "options": ["take", "make", "do", "have"],
            "correct_index": 0,
            "explanation": "'Take a shower' is the common phrase."
        },
        "fill": {
            "sentence": "I go to ___ at 10 PM and ___.",
            "blanks": [
                {"position": 1, "options": ["bed", "sleep", "room"], "correct": "bed"},
                {"position": 2, "options": ["sleep", "sleeps", "slept"], "correct": "sleep"}
            ]
        },
        "sort": ["She", "goes", "to", "bed", "very", "late"]
    },
    # Lesson 9
    {
        "title": "Days of the Week",
        "description": "Learn the seven days of the week.",
        "vocab": [
            ("Monday", "First day of work week"),
            ("Friday", "Last day of work week"),
            ("Weekend", "Saturday and Sunday"),
            ("on", "preposition for days (on Monday)")
        ],
        "mcq": {
            "question": "I don't work ___ the weekend.",
            "options": ["on", "in", "at", "for"],
            "correct_index": 0,
            "explanation": "We say 'on the weekend' or 'at the weekend'."
        },
        "fill": {
            "sentence": "Today is ___ and tomorrow is ___.",
            "blanks": [
                {"position": 1, "options": ["Monday", "Week", "Day"], "correct": "Monday"},
                {"position": 2, "options": ["Tuesday", "Weekend", "Night"], "correct": "Tuesday"}
            ]
        },
        "sort": ["We", "relax", "on", "Saturday", "and", "Sunday"]
    },
    # Lesson 10
    {
        "title": "Full Daily Schedule",
        "description": "Review and combine time and routines.",
        "vocab": [
            ("every day", "each day"),
            ("early", "near the beginning of the day"),
            ("late", "near the end of the day"),
            ("busy", "having a lot to do")
        ],
        "mcq": {
            "question": "I have a very ___ schedule.",
            "options": ["busy", "early", "late", "time"],
            "correct_index": 0,
            "explanation": "A schedule with a lot to do is 'busy'."
        },
        "fill": {
            "sentence": "I wake up ___, work hard, and sleep ___.",
            "blanks": [
                {"position": 1, "options": ["early", "late", "busy"], "correct": "early"},
                {"position": 2, "options": ["late", "early", "time"], "correct": "late"}
            ]
        },
        "sort": ["I", "wake", "up", "early", "every", "day"]
    }
]

out_lessons = []
for i, l in enumerate(lessons_data):
    l_num = i + 1
    l_id = f"a1_unit6_lesson{l_num:02d}"
    tasks = []
    
    # 1. Learn Card
    tasks.append(create_task(f"t06{l_num:02d}_01", 1, "learn_card", "vocabulary", l["title"], {
        "explanation": "Let's learn some new words.",
        "structure": "Pay attention to how these are used.",
        "examples": [{"sentence": k, "note": v} for k, v in l["vocab"]]
    }))
    
    # 2. MCQ
    tasks.append(create_task(f"t06{l_num:02d}_02", 2, "mcq", "vocabulary", "Choose the correct word", l["mcq"]))
    
    # 3. Fill in the blank
    tasks.append(create_task(f"t06{l_num:02d}_03", 3, "fill_blank", "grammar", "Fill the blanks", {
        "sentence": l["fill"]["sentence"],
        "blanks": l["fill"]["blanks"],
        "explanation": "Complete the sentence with the correct form."
    }))
    
    # 4. Sort words
    tasks.append(create_task(f"t06{l_num:02d}_04", 4, "sort_words", "grammar", "Build the sentence", {
        "instruction": "Rearrange to make a sentence.",
        "words": sorted(l["sort"], key=lambda x: len(x)), # Just shuffle a bit
        "correct_sentence": " ".join(l["sort"]),
        "explanation": "Put the words in the correct order."
    }))
    
    # 5. Lesson Summary
    next_l_title = lessons_data[i+1]["title"] if i < 9 else "Unit 6 Complete!"
    next_l_id = f"a1_unit6_lesson{(l_num+1):02d}" if i < 9 else ""
    
    summary_content = {
        "what_you_learned": [v[0] for v in l["vocab"][:2]],
        "next_lesson": next_l_id,
        "next_lesson_title": next_l_title
    }
    tasks.append(create_task(f"t06{l_num:02d}_05", 5, "lesson_summary", "review", "Lesson complete!", summary_content))
    
    out_lessons.append({
        "lesson_id": l_id,
        "unit": 6,
        "lesson_number": l_num,
        "level": "A1",
        "title": l["title"],
        "description": l["description"],
        "estimated_minutes": 15,
        "xp_reward": 100,
        "tasks": tasks
    })

unit_json = {
    "unit": {
        "unit_number": 6,
        "lessons": out_lessons
    }
}

target_file = r"c:\Users\acer\OneDrive\Documents\l2\backend\utils\unit6_lessons.json"
with open(target_file, "w", encoding="utf-8") as f:
    json.dump(unit_json, f, indent=2)

print(f"Generated {len(out_lessons)} lessons for Unit 6 and saved to {target_file}")
