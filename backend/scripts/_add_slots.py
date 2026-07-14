import json

with open("backend/data/academic_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for course in data["courses"]:
    if course["title"] == "American Studies":
        course["slotsPerSemester"] = 2
        print(f"Added slotsPerSemester=2 to {course['title']}")

with open("backend/data/academic_data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print("Done")
