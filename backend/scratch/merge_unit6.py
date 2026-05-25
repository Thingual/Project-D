import json
import os

def main():
    files = [
        "unit-6-lesson-1.json",
        "unit-6-lesson-2.json",
        "unit-6-lesson-3.json",
        "unit-6-lesson-4.json",
        "unit-6-lesson05.json",
        "unit-6-lesson-6.json",
        "unit-6-lesson-7.json",
        "unit-6-lesson-8.json",
    ]
    
    dir_path = r"c:\Users\acer\OneDrive\Documents\l2\frontend\public\a1_unit_6"
    lessons = []
    
    for filename in files:
        file_path = os.path.join(dir_path, filename)
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            lessons.append(data)
            
    output_data = {
        "unit": {
            "unit_number": 6,
            "lessons": lessons
        }
    }
    
    out_path = r"c:\Users\acer\OneDrive\Documents\l2\backend\utils\unit6_lessons.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Successfully merged {len(lessons)} lessons into {out_path}")

if __name__ == "__main__":
    main()
