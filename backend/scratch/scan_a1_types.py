import os
import json

folder = "c:\\Users\\acer\\OneDrive\\Documents\\l2\\frontend\\public\\a1_unit_1"
files = [f for f in os.listdir(folder) if f.endswith(".json")]

task_types = set()
for f in files:
    with open(os.path.join(folder, f), "r", encoding="utf-8") as file:
        data = json.load(file)
        tasks = data.get("tasks", [])
        for t in tasks:
            task_types.add(t.get("type"))

print("Task types in A1 unit 1 local JSONs:", task_types)
