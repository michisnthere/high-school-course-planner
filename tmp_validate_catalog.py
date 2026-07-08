#!/usr/bin/env python3
"""Comprehensive validation of extractor/output/academic-data.json."""
import json
from collections import defaultdict, Counter
from pathlib import Path

PATH = Path("extractor/output/academic-data.json")

VALID_SEMESTERS = {"Semester 1", "Semester 2"}
VALID_DURATIONS = {"One Semester", "Full Year"}
VALID_GRADES = {9, 10, 11, 12}
EXPECTED_ATTR_KEYS = {"isRepeatable", "requiresAudition", "requiresApplication"}


def load():
    with open(PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def course_import_key(c):
    return f"{c.get('sourceReference', '')}::{c.get('title', '')}"


def offering_codes(offering_groups):
    """Return list of (choice_index, code) for each offering."""
    result = []
    for i, group in enumerate(offering_groups):
        for o in group:
            result.append((i, o.get("courseCode")))
    return result


def validate():
    data = load()
    courses = data.get("courses", [])
    divisions = data.get("divisions", [])
    grad_reqs = data.get("graduationRequirements", [])

    issues = defaultdict(list)
    warnings = defaultdict(list)
    stats = {}

    # --- Build reference sets ---
    division_names = {d.get("name") for d in divisions}
    department_to_division = {}
    for d in divisions:
        div_name = d.get("name")
        for dept in d.get("departments", []):
            dept_name = dept.get("name")
            if dept_name in department_to_division:
                issues["department_in_multiple_divisions"].append(dept_name)
            department_to_division[dept_name] = div_name

    grad_req_names = {r.get("name") for r in grad_reqs}

    # --- Graduation requirement duplicates ---
    grad_req_triples = defaultdict(list)
    for r in grad_reqs:
        triple = (r.get("name"), r.get("category"), r.get("requirementType"))
        grad_req_triples[triple].append(r.get("name"))
    for triple, names in grad_req_triples.items():
        if len(names) > 1:
            issues["duplicate_graduation_requirement_triples"].append(triple)

    # --- Course-level validation ---
    total_choices = 0
    total_offerings = 0
    title_counter = Counter()
    import_key_counter = Counter()

    for c in courses:
        title = c.get("title", "<untitled>")
        title_counter[title] += 1
        import_key_counter[course_import_key(c)] += 1

        # Required fields
        for field in ("title", "description", "sourceReference", "fulfillsRequirements", "attributes"):
            if field not in c:
                issues[f"missing_required_field"].append((title, field))

        # Division / department membership
        div = c.get("division")
        dept = c.get("department")
        if not div:
            issues["course_missing_division"].append(title)
        elif div not in division_names:
            issues["course_unknown_division"].append((title, div))
        if not dept:
            issues["course_missing_department"].append(title)
        elif dept not in department_to_division:
            issues["course_unknown_department"].append((title, dept))
        elif div and department_to_division.get(dept) != div:
            issues["course_department_division_mismatch"].append(
                (title, dept, div, department_to_division.get(dept))
            )

        # offerings vs choices
        has_offerings = bool(c.get("offerings"))
        has_choices = bool(c.get("choices"))
        if has_offerings and has_choices:
            issues["course_has_both_offerings_and_choices"].append(title)
        if not has_offerings and not has_choices:
            issues["course_has_neither_offerings_nor_choices"].append(title)

        # Choices
        if has_choices:
            total_choices += len(c.get("choices", []))
            choice_groups = []
            for idx, ch in enumerate(c.get("choices", [])):
                for field in ("name", "isOnline", "creditType", "credits", "gpaWaiverOption", "offerings"):
                    if field not in ch:
                        issues["choice_missing_required_field"].append((title, ch.get("name", f"choice#{idx}"), field))
                if not ch.get("offerings"):
                    issues["choice_without_offerings"].append((title, ch.get("name", f"choice#{idx}")))
                choice_groups.append(ch.get("offerings", []))

            # Check duplicate codes within same choice
            for idx, group in enumerate(choice_groups):
                codes = [o.get("courseCode") for o in group]
                seen = set()
                for code in codes:
                    if code in seen:
                        issues["duplicate_course_code_within_choice"].append((title, idx, code))
                    seen.add(code)

            # Check duplicate codes across different choices (allowed, report as warning for visibility)
            all_codes = [o.get("courseCode") for group in choice_groups for o in group]
            total_choice_offerings = sum(len(g) for g in choice_groups)
            if len(all_codes) != len(set(all_codes)):
                warnings["duplicate_course_code_across_choices"].append(title)
            total_offerings += total_choice_offerings

        # Offerings (single-version)
        if has_offerings:
            total_offerings += len(c.get("offerings", []))
            for o in c.get("offerings", []):
                for field in ("courseCode", "semesterLabel", "duration", "gradeLevels", "prerequisites"):
                    if field not in o:
                        issues["offering_missing_required_field"].append((title, o.get("courseCode"), field))
                if o.get("semesterLabel") not in VALID_SEMESTERS:
                    issues["offering_invalid_semester_label"].append((title, o.get("courseCode"), o.get("semesterLabel")))
                if o.get("duration") not in VALID_DURATIONS:
                    issues["offering_unnormalized_duration"].append((title, o.get("courseCode"), o.get("duration")))
                grades = o.get("gradeLevels", [])
                if not isinstance(grades, list) or not grades:
                    issues["offering_missing_grade_levels"].append((title, o.get("courseCode")))
                else:
                    for g in grades:
                        if g not in VALID_GRADES:
                            issues["offering_invalid_grade_level"].append((title, o.get("courseCode"), g))
                prereqs = o.get("prerequisites")
                if not isinstance(prereqs, list):
                    issues["offering_prerequisites_not_array"].append((title, o.get("courseCode")))

        # fulfillsRequirements
        frs = c.get("fulfillsRequirements", [])
        if not isinstance(frs, list):
            issues["fulfills_requirements_not_array"].append(title)
        else:
            seen_frs = set()
            for fr in frs:
                if fr in seen_frs:
                    issues["duplicate_fulfills_requirement_in_course"].append((title, fr))
                seen_frs.add(fr)
                if fr not in grad_req_names:
                    issues["unknown_fulfills_requirement"].append((title, fr))

        # Attributes
        attrs = c.get("attributes", {})
        if not isinstance(attrs, dict):
            issues["attributes_not_object"].append(title)
        else:
            missing = EXPECTED_ATTR_KEYS - set(attrs.keys())
            extra = set(attrs.keys()) - EXPECTED_ATTR_KEYS
            if missing:
                warnings["attributes_missing_keys"].append((title, sorted(missing)))
            if extra:
                warnings["attributes_unexpected_keys"].append((title, sorted(extra)))

        # Communication Arts
        if div == "Communication Arts":
            if "English" not in frs:
                issues["communication_arts_missing_english"].append(title)

    # --- Duplicate titles / import keys ---
    for title, count in title_counter.items():
        if count > 1:
            issues["duplicate_course_titles"].append((title, count))
    for key, count in import_key_counter.items():
        if count > 1:
            issues["duplicate_import_keys"].append((key, count))

    # --- Orphan divisions / departments ---
    divisions_with_courses = {c.get("division") for c in courses}
    orphan_divisions = division_names - divisions_with_courses
    if orphan_divisions:
        warnings["orphan_divisions_no_courses"].extend(sorted(orphan_divisions))

    departments_with_courses = {c.get("department") for c in courses}
    orphan_departments = set(department_to_division.keys()) - departments_with_courses
    if orphan_departments:
        warnings["orphan_departments_no_courses"].extend(sorted(orphan_departments))

    # --- Summary stats ---
    stats = {
        "divisions": len(divisions),
        "departments": len(department_to_division),
        "courses": len(courses),
        "choices": total_choices,
        "offerings": total_offerings,
        "graduation_requirements": len(grad_reqs),
    }

    return stats, issues, warnings


def print_section(title, items, indent=2):
    if not items:
        return
    print(f"\n{title} ({len(items)})")
    prefix = " " * indent
    for item in items[:20]:
        print(f"{prefix}- {item}")
    if len(items) > 20:
        print(f"{prefix}... and {len(items) - 20} more")


def main():
    stats, issues, warnings = validate()

    print("=" * 60)
    print("CATALOG VALIDATION REPORT")
    print("=" * 60)

    print("\n--- Summary ---")
    for k, v in stats.items():
        print(f"  {k}: {v}")

    print("\n--- Critical Issues (prevent import or data integrity) ---")
    if not issues:
        print("  None")
    else:
        for key, items in sorted(issues.items()):
            print_section(key.replace("_", " ").title(), items)

    print("\n--- Warnings / Non-critical Findings ---")
    if not warnings:
        print("  None")
    else:
        for key, items in sorted(warnings.items()):
            print_section(key.replace("_", " ").title(), items)

    print("\n" + "=" * 60)
    if issues:
        print("Remaining issues requiring correction:")
        for key in sorted(issues.keys()):
            print(f"  - {key.replace('_', ' ').title()}: {len(issues[key])} occurrence(s)")
    else:
        print("Dataset is production-ready.")
    print("=" * 60)


if __name__ == "__main__":
    main()
