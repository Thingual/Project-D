import json
import os
import google.generativeai as genai

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel('gemini-pro')

def generate_lesson(lesson_outline):
    prompt = f"""
You are an expert English curriculum designer. I have an outline for an A1 level English lesson with 20 tasks.
Your job is to expand this outline into fully formed JSON tasks that match our app's specific formats.

Here is the outline for the lesson:
{json.dumps(lesson_outline, indent=2)}

You must return a JSON array of exactly 20 objects, each corresponding to one of the tasks in the outline.
Use the following task types ONLY. DO NOT use the types from the outline directly if they don't match these:
- "learn_card": {{ "task_id": "...", "type": "learn_card", "prompt": "...", "content": {{ "grammar_focus": "...", "example_sentences": ["..."], "context": "..." }} }}
- "listen_repeat": {{ "task_id": "...", "type": "listen_repeat", "prompt": "...", "audio_key": "...", "content": {{ "target_phrases": ["..."] }} }}
- "mcq": {{ "task_id": "...", "type": "mcq", "prompt": "...", "question": "...", "options": ["..."], "correct_option_index": 0 }}
- "fill_blank": {{ "task_id": "...", "type": "fill_blank", "prompt": "...", "question": "I am ___ home.", "answer": "going" }} (Note: only one answer allowed)
- "sort_words": {{ "task_id": "...", "type": "sort_words", "prompt": "...", "scramble": ["word1", "word2"], "answer": "word1 word2" }}
- "match_pairs": {{ "task_id": "...", "type": "match_pairs", "prompt": "...", "pairs": [{{ "left": "...", "right": "..." }}] }}
- "error_correction": {{ "task_id": "...", "type": "error_correction", "prompt": "...", "instruction": "...", "wrong_sentence": "...", "correct_sentence": "..." }}
- "scenario_mcq": {{ "task_id": "...", "type": "scenario_mcq", "prompt": "...", "question": "...", "options": ["..."], "correct_option_index": 0 }}
- "speaking": {{ "task_id": "...", "type": "speaking", "prompt": "...", "content": {{ "min_words": 50, "example_response": "..." }} }}
- "dialogue": {{ "task_id": "...", "type": "dialogue", "prompt": "...", "dialogue": {{ "setting": "...", "turns": [{{ "speaker": "...", "text": "..." }}] }}, "comprehension_questions": [{{ "question": "...", "expected_answer": "..." }}] }}
- "lesson_summary": {{ "task_id": "...", "type": "lesson_summary", "prompt": "...", "content": {{ "checklist": ["..."] }} }}

Map the outline's intent to one of the valid types. Ensure all 20 tasks are present and fully fleshed out with realistic, culturally relevant examples (Indian context preferred, like Mumbai, Chennai, etc. if applicable, but general English is fine).
Make sure it is valid JSON, containing only the array of 20 tasks. Do not include markdown blocks.
"""
    response = model.generate_content(prompt)
    text = response.text.replace('```json','').replace('```','').strip()
    return json.loads(text)

def main():
    outline_path = r"c:\Users\acer\OneDrive\Documents\l2\frontend\public\a1_unit_6\unit-6-lesson-1 to 4.json"
    with open(outline_path, "r", encoding="utf-8") as f:
        outline_data = json.load(f)
    
    lessons = outline_data.get("lessons", [])
    for i, l in enumerate(lessons):
        lesson_number = i + 1
        print(f"Generating lesson {lesson_number}...")
        tasks = generate_lesson(l)
        
        full_lesson = {
            "lesson_id": f"a1_unit6_lesson0{lesson_number}",
            "unit": 6,
            "lesson_number": lesson_number,
            "level": "A1",
            "title": l.get("lesson_title", f"Lesson {lesson_number}"),
            "description": "Generated lesson from outline.",
            "estimated_minutes": l.get("estimated_minutes_total", 30),
            "xp_reward": 150,
            "tasks": tasks
        }
        
        out_path = fr"c:\Users\acer\OneDrive\Documents\l2\frontend\public\a1_unit_6\unit-6-lesson-{lesson_number}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(full_lesson, f, indent=2)
        print(f"Saved {out_path}")

if __name__ == "__main__":
    main()
