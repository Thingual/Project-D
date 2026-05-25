import os
import json

def merge():
    frontend_dir = r"c:\Users\acer\OneDrive\Documents\l2\frontend\public\A2\Unit-12"
    backend_utils = r"c:\Users\acer\OneDrive\Documents\l2\backend\utils"
    
    files = [
        "a2_unit12_lesson01.json",
        "a2_unit12_lesson02.json",
        "a2_unit12_lessons03_04_05.json",
        "a2_unit12_lesson06.json",
        "a2_unit12_lesson07.json",
        "a2_unit12_lesson08.json",
        "a2_unit12_lessons09_10_11.json",
        "a2_unit12_lesson12.json",
        "a2_unit12_lesson13.json",
        "a2_unit12_lesson14.json"
    ]
    
    merged_lessons = []
    
    for filename in files:
        filepath = os.path.join(frontend_dir, filename)
        if not os.path.exists(filepath):
            print(f"File not found: {filepath}")
            continue
            
        with open(filepath, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
            
        if isinstance(data, list):
            merged_lessons.extend(data)
        elif isinstance(data, dict):
            # Might be a single lesson or contains a lessons list
            if "lessons" in data:
                merged_lessons.extend(data["lessons"])
            else:
                merged_lessons.append(data)
                
    output_data = {
        "unit": 12,
        "level": "A2",
        "title": "Present Perfect / Life Experiences",
        "description": "Master life experiences using the present perfect tense with ever, never, already, yet, just, and still.",
        "total_lessons": len(merged_lessons),
        "lessons": merged_lessons
    }
    
    output_filepath = os.path.join(backend_utils, "unit12_lessons.json")
    with open(output_filepath, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully merged {len(merged_lessons)} lessons into {output_filepath}")

if __name__ == "__main__":
    merge()
