from __future__ import annotations

import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DRAFT_PATH = PROJECT_ROOT / "data" / "structured" / "academic-data.rule-based-draft.json"
REPORT_PATH = PROJECT_ROOT / "data" / "reports" / "rule-extraction-report.json"
SUMMARY_PATH = PROJECT_ROOT / "data" / "reports" / "validation_summary.json"
MDRPT_PATH = PROJECT_ROOT / "data" / "reports" / "validation_report.md"

PAGE_RE = re.compile(r"Page\s+(\d+)")
WARN_FAILED_PARSE_RE = re.compile(r"failed to parse", re.IGNORECASE)
WARN_COMPLEX_PREREQ_RE = re.compile(r"complex prerequisite", re.IGNORECASE)
WARN_CREDIT_INFERENCE_RE = re.compile(r"credit inference count")


def _load_json(path: Path) -> Any:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _page_from_course(course: Dict[str, Any]) -> int:
    ref = course.get("sourceReference", "")
    m = PAGE_RE.search(ref)
    return int(m.group(1)) if m else 0


def _group_courses_by_page(
    courses: List[Dict[str, Any]],
) -> Dict[int, List[Dict[str, Any]]]:
    grouped: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for c in courses:
        p = _page_from_course(c)
        if p:
            grouped[p].append(c)
    return dict(grouped)


def _check_empty_pages(
    grouped: Dict[int, List[Dict[str, Any]]],
    report: Any,
) -> List[int]:
    extracted_pages: List[int] = []
    if report and "extractedPages" in report:
        extracted_pages = report["extractedPages"]
    elif report and "pageSummaries" in report:
        extracted_pages = [s["page"] for s in report["pageSummaries"]]
    empty: List[int] = []
    for p in extracted_pages:
        courses_on_page = grouped.get(p, [])
        if not courses_on_page:
            empty.append(p)
    return empty


def _check_course_count_anomalies(
    grouped: Dict[int, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    counts = list(grouped.values())
    if len(counts) < 3:
        return []
    values = [len(v) for v in counts]
    baseline = statistics.median(values)
    if baseline == 0:
        return []
    anomalies: List[Dict[str, Any]] = []
    for p, courses in grouped.items():
        actual = len(courses)
        delta = abs(actual - baseline) / baseline
        if delta > 0.5:
            anomalies.append({
                "page": p,
                "expected": round(baseline, 1),
                "actual": actual,
                "delta": round(delta, 3),
            })
    return anomalies


def _check_departments(
    courses: List[Dict[str, Any]],
    grouped: Dict[int, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    total = len(courses)
    if total == 0:
        return {"null_percentage": 0.0, "problem_pages": []}
    null_count = sum(1 for c in courses if c.get("department") is None)
    problem_pages: List[int] = []
    for p, clist in grouped.items():
        if clist and clist[0].get("department") is None:
            problem_pages.append(p)
    return {
        "null_percentage": round(null_count / total * 100, 1),
        "problem_pages": sorted(set(problem_pages)),
    }


def _classify_warning(text: str) -> str:
    if WARN_FAILED_PARSE_RE.search(text):
        return "failed_parse"
    if WARN_COMPLEX_PREREQ_RE.search(text):
        return "complex_prerequisite"
    if WARN_CREDIT_INFERENCE_RE.search(text):
        return "credit_inference_summary"
    return "other"


def _analyze_warnings(
    warnings: List[str],
    grouped: Dict[int, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    categories: Dict[str, int] = Counter()
    for w in warnings:
        categories[_classify_warning(w)] += 1
    page_warn_counts: Dict[int, int] = Counter()
    for w in warnings:
        m = PAGE_RE.search(w)
        if m:
            page_warn_counts[int(m.group(1))] += 1
    spikes: List[int] = []
    if page_warn_counts:
        values = list(page_warn_counts.values())
        if len(values) >= 3:
            med = statistics.median(values)
            if med > 0:
                for p, cnt in page_warn_counts.items():
                    if cnt > 2 * med:
                        spikes.append(p)
    return {
        "warning_summary": {
            "failed_parse": categories.get("failed_parse", 0),
            "complex_prerequisite": categories.get("complex_prerequisite", 0),
            "credit_inference_summary": categories.get("credit_inference_summary", 0),
            "other": categories.get("other", 0),
        },
        "spike_pages": sorted(spikes),
    }


def _check_schema(courses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    errors: List[Dict[str, Any]] = []
    for c in courses:
        p = _page_from_course(c)
        title = c.get("title")
        if not title or not isinstance(title, str) or not title.strip():
            errors.append({"page": p, "issue": "missing or empty title", "course": c})
        code = c.get("code")
        offerings = c.get("offerings", [])
        if not offerings or not isinstance(offerings, list):
            errors.append({
                "page": p,
                "issue": "missing or empty offerings list",
                "course": c,
            })
        else:
            for o in offerings:
                oc = o.get("courseCode")
                if not oc or not isinstance(oc, str) or not oc.strip():
                    errors.append({
                        "page": p,
                        "issue": "offering missing courseCode",
                        "course": c,
                    })
                    break
    return errors


def _check_duplicates(
    grouped: Dict[int, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    anomalies: List[Dict[str, Any]] = []
    for p, clist in grouped.items():
        seen_codes: Dict[str, int] = Counter()
        for c in clist:
            for o in c.get("offerings", []):
                code = o.get("courseCode")
                if code:
                    seen_codes[code] += 1
        for code, count in seen_codes.items():
            if count > 1:
                titles = [c["title"] for c in clist if any(
                    o.get("courseCode") == code for o in c.get("offerings", [])
                )]
                anomalies.append({
                    "page": p,
                    "code": code,
                    "title": titles[0] if titles else "",
                    "count": count,
                })
    return anomalies


def _compute_health(
    empty_pages: List[int],
    schema_errors: List[Dict[str, Any]],
    dept_stats: Dict[str, Any],
    warning_analysis: Dict[str, Any],
    duplicates: List[Dict[str, Any]],
) -> int:
    score = 100
    score -= len(empty_pages) * 30
    if schema_errors:
        score -= 20
    if dept_stats.get("null_percentage", 0) > 30:
        score -= 15
    if warning_analysis.get("spike_pages"):
        score -= 10
    if duplicates:
        score -= 10
    return max(0, min(100, score))


def _build_markdown(
    empty_pages: List[int],
    count_anomalies: List[Dict[str, Any]],
    dept_stats: Dict[str, Any],
    schema_errors: List[Dict[str, Any]],
    warning_analysis: Dict[str, Any],
    duplicates: List[Dict[str, Any]],
    health_score: int,
    total_courses: int,
) -> str:
    lines: List[str] = []
    lines.append("# Validation Report\n")
    lines.append(f"Health Score: {health_score}/100\n")

    lines.append("## Empty Pages\n")
    if empty_pages:
        for p in empty_pages:
            lines.append(f"- Page {p}")
    else:
        lines.append("- None\n")

    lines.append("\n## Course Count Anomalies\n")
    if count_anomalies:
        for a in count_anomalies:
            lines.append(
                f"- Page {a['page']}: expected {a['expected']}, "
                f"got {a['actual']} (delta {a['delta']})"
            )
    else:
        lines.append("- None\n")

    lines.append("\n## Department Issues\n")
    lines.append(f"- Null department rate: {dept_stats['null_percentage']}%")
    if dept_stats["problem_pages"]:
        lines.append(f"- Problem pages: {dept_stats['problem_pages']}")
    else:
        lines.append("- No problem pages detected")

    lines.append("\n## Schema Errors\n")
    if schema_errors:
        for e in schema_errors:
            lines.append(f"- Page {e['page']}: {e['issue']}")
    else:
        lines.append("- None\n")

    lines.append("\n## Warning Summary\n")
    ws = warning_analysis.get("warning_summary", {})
    lines.append(f"- Failed parse: {ws.get('failed_parse', 0)}")
    lines.append(f"- Complex prerequisite: {ws.get('complex_prerequisite', 0)}")
    lines.append(f"- Credit inference: {ws.get('credit_inference_summary', 0)}")
    lines.append(f"- Other: {ws.get('other', 0)}")
    if warning_analysis.get("spike_pages"):
        lines.append(f"- Warning spikes on pages: {warning_analysis['spike_pages']}")

    lines.append("\n## Duplicates\n")
    if duplicates:
        for d in duplicates:
            lines.append(f"- Page {d['page']}: {d['code']} ({d['title']}) x{d['count']}")
    else:
        lines.append("- None\n")

    threshold = 85
    verdict = "PASS" if health_score >= threshold else "FAIL"
    lines.append(f"\n## Final Verdict\n- **{verdict}** (threshold: {threshold})")
    return "\n".join(lines)


def main() -> None:
    draft = _load_json(DRAFT_PATH)
    if draft is None:
        msg = "Draft JSON not found. Run rule_extract_book.py first."
        print(f"ERROR: {msg}")
        summary = {
            "error": msg,
            "empty_course_pages": [],
            "course_count_anomalies": [],
            "department_null_stats": {"null_percentage": 0.0, "problem_pages": []},
            "warning_summary": {"failed_parse": 0, "complex_prerequisite": 0, "credit_inference_summary": 0, "other": 0},
            "schema_errors": [],
            "duplicate_anomalies": [],
            "health_score": 0,
        }
        SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
        SUMMARY_PATH.write_text(
            json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        MDRPT_PATH.write_text("# Validation Report\n\nError: Draft JSON not found.", encoding="utf-8")
        return

    report = _load_json(REPORT_PATH)
    courses: List[Dict[str, Any]] = draft.get("courses", [])
    warnings_list: List[str] = draft.get("warnings", [])
    grouped = _group_courses_by_page(courses)

    empty_pages = _check_empty_pages(grouped, report)
    count_anomalies = _check_course_count_anomalies(grouped)
    dept_stats = _check_departments(courses, grouped)
    warning_analysis = _analyze_warnings(warnings_list, grouped)
    schema_errors = _check_schema(courses)
    duplicates = _check_duplicates(grouped)
    health_score = _compute_health(
        empty_pages, schema_errors, dept_stats, warning_analysis, duplicates
    )

    summary = {
        "empty_course_pages": empty_pages,
        "course_count_anomalies": count_anomalies,
        "department_null_stats": dept_stats,
        "warning_summary": warning_analysis["warning_summary"],
        "warning_spike_pages": warning_analysis["spike_pages"],
        "schema_errors": schema_errors,
        "duplicate_anomalies": duplicates,
        "health_score": health_score,
    }

    SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_PATH.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    md = _build_markdown(
        empty_pages,
        count_anomalies,
        dept_stats,
        schema_errors,
        warning_analysis,
        duplicates,
        health_score,
        len(courses),
    )
    MDRPT_PATH.write_text(md, encoding="utf-8")

    print(f"Validation complete. Health Score: {health_score}/100")
    print(f"  JSON summary: {SUMMARY_PATH}")
    print(f"  Markdown report: {MDRPT_PATH}")


if __name__ == "__main__":
    main()
