from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import finalize_academic_json as finalizer


SINGLE_VERSION_COURSE = {
    "title": "Introduction to Business",
    "department": "Business Education",
    "description": "A foundational business course.",
    "gpaWaiverOption": False,
    "creditType": "College Prep",
    "credits": 1.0,
    "offerings": [
        {
            "courseCode": "BUS171",
            "semesterLabel": "Semester 1",
            "duration": "One Semester",
            "gradeLevels": [9, 10],
            "prerequisites": [],
            "creditType": "College Prep",
            "credits": 1.0,
            "notes": [],
        },
        {
            "courseCode": "BUS172",
            "semesterLabel": "Semester 2",
            "duration": "One Semester",
            "gradeLevels": [9, 10],
            "prerequisites": [],
            "creditType": "College Prep",
            "credits": 1.0,
            "notes": [],
        },
    ],
    "notes": [],
    "sourceReference": "page 16",
}


MIXED_CREDIT_COURSE = {
    "title": "Clothing and Design 2",
    "department": "Family and Consumer Sciences",
    "description": "Advanced clothing skills.",
    "gpaWaiverOption": False,
    "creditType": "College Prep",
    "credits": 1.0,
    "offerings": [
        {
            "courseCode": "FCS291",
            "semesterLabel": "Semester 1",
            "duration": "One Semester",
            "gradeLevels": [10, 11, 12],
            "prerequisites": ["Clothing and Design 1"],
            "creditType": "College Prep",
            "credits": 1.0,
            "notes": [],
        },
        {
            "courseCode": "FCS292",
            "semesterLabel": "Semester 2",
            "duration": "One Semester",
            "gradeLevels": [10, 11, 12],
            "prerequisites": ["Clothing and Design 1"],
            "creditType": "Honors",
            "credits": 1.0,
            "notes": [],
        },
    ],
    "notes": [],
    "sourceReference": "page 21",
}


OPTIONS_COURSE = {
    "title": "Wind Ensemble",
    "department": "Music",
    "description": "Advanced band ensemble.",
    "offerings": [
        {
            "courseCode": "MUS141",
            "semesterLabel": "Semester 1",
            "duration": "Full Year",
            "gradeLevels": [10, 11, 12],
            "prerequisites": [],
            "creditType": "College Prep",
            "credits": 1.0,
            "notes": [],
        },
        {
            "courseCode": "MUS142",
            "semesterLabel": "Semester 2",
            "duration": "Full Year",
            "gradeLevels": [10, 11, 12],
            "prerequisites": [],
            "creditType": "College Prep",
            "credits": 1.0,
            "notes": [],
        },
    ],
    "options": [
        {"creditType": "College Prep", "gpaWaived": True},
        {"creditType": "Accelerated", "gpaWaived": False},
    ],
    "notes": [],
    "sourceReference": "page 57",
    "creditType": "College Prep",
    "credits": 1.0,
    "gpaWaiverOption": False,
}


CREDIT_TYPE_REQUIREMENT_COURSE = {
    "title": "Biology",
    "department": "Science",
    "description": "A college preparatory biological science course.",
    "gpaWaiverOption": False,
    "creditType": "College Prep Biological Science",
    "credits": 1.0,
    "offerings": [
        {
            "courseCode": "SCI111",
            "semesterLabel": "Semester 1",
            "duration": "Full Year",
            "gradeLevels": [9, 10],
            "prerequisites": [],
            "creditType": "College Prep Biological Science",
            "credits": 1.0,
            "notes": [],
        },
        {
            "courseCode": "SCI112",
            "semesterLabel": "Semester 2",
            "duration": "Full Year",
            "gradeLevels": [9, 10],
            "prerequisites": [],
            "creditType": "College Prep Biological Science",
            "credits": 1.0,
            "notes": [],
        },
    ],
    "notes": [],
    "sourceReference": "page 80",
}


class TestFinalizeAcademicJson(unittest.TestCase):
    def _validate(self, course: dict) -> list[str]:
        return finalizer._validate_course(course, Path("test"), 0)

    def test_single_version_course_collapse(self):
        result = finalizer._finalize_course(copy.deepcopy(SINGLE_VERSION_COURSE))
        self.assertNotIn("choices", result)
        self.assertEqual(result["creditType"], "College Prep")
        self.assertEqual(result["credits"], 1.0)
        self.assertIs(result["gpaWaiverOption"], False)
        self.assertIn("fulfillsRequirements", result)
        self.assertEqual(result["fulfillsRequirements"], [])
        self.assertEqual(len(result["offerings"]), 2)
        for o in result["offerings"]:
            self.assertNotIn("creditType", o)
            self.assertNotIn("credits", o)
            self.assertNotIn("notes", o)
        self.assertEqual(self._validate(result), [])

    def test_mixed_credit_metadata_splits_into_choices(self):
        result = finalizer._finalize_course(copy.deepcopy(MIXED_CREDIT_COURSE))
        self.assertIn("choices", result)
        self.assertNotIn("offerings", result)
        self.assertNotIn("creditType", result)
        self.assertNotIn("credits", result)
        self.assertIn("fulfillsRequirements", result)
        self.assertEqual(result["fulfillsRequirements"], [])

        choices = result["choices"]
        self.assertEqual(len(choices), 2)

        cp = next(c for c in choices if c["name"] == "College Prep")
        hn = next(c for c in choices if c["name"] == "Honors")

        self.assertEqual(cp["creditType"], "College Prep")
        self.assertEqual(cp["credits"], 1.0)
        self.assertEqual(len(cp["offerings"]), 1)
        self.assertEqual(cp["offerings"][0]["courseCode"], "FCS291")

        self.assertEqual(hn["creditType"], "Honors")
        self.assertEqual(hn["credits"], 1.0)
        self.assertEqual(len(hn["offerings"]), 1)
        self.assertEqual(hn["offerings"][0]["courseCode"], "FCS292")

        self.assertEqual(self._validate(result), [])

    def test_options_converted_to_choices(self):
        result = finalizer._finalize_course(copy.deepcopy(OPTIONS_COURSE))
        self.assertNotIn("options", result)
        self.assertIn("choices", result)
        self.assertEqual(len(result["choices"]), 2)
        self.assertIn("fulfillsRequirements", result)
        self.assertEqual(result["fulfillsRequirements"], ["Fine Arts"])

        names = {c["name"] for c in result["choices"]}
        self.assertEqual(names, {"College Prep", "Accelerated"})

        for ch in result["choices"]:
            self.assertIn("creditType", ch)
            self.assertIn("credits", ch)
            self.assertIn("gpaWaiverOption", ch)
            self.assertIn("isOnline", ch)
            self.assertEqual(len(ch["offerings"]), 2)
            for o in ch["offerings"]:
                self.assertNotIn("creditType", o)
                self.assertNotIn("credits", o)

        self.assertEqual(self._validate(result), [])

    def test_credit_type_requirements_normalized(self):
        result = finalizer._finalize_course(copy.deepcopy(CREDIT_TYPE_REQUIREMENT_COURSE))
        self.assertNotIn("choices", result)
        self.assertEqual(result["creditType"], "College Prep")
        self.assertIn("fulfillsRequirements", result)
        self.assertEqual(result["fulfillsRequirements"], ["Biology"])
        self.assertEqual(self._validate(result), [])

    def test_credit_type_multiple_requirements_extracted(self):
        course = {
            "title": "Integrated Science",
            "department": "Science",
            "description": "An interdisciplinary science course.",
            "gpaWaiverOption": False,
            "creditType": "Honors Biological Science, Honors Physical Science",
            "credits": 1.0,
            "offerings": [
                {
                    "courseCode": "SCI001",
                    "semesterLabel": "Semester 1",
                    "duration": "Full Year",
                    "gradeLevels": [9, 10],
                    "prerequisites": [],
                    "creditType": "Honors Biological Science, Honors Physical Science",
                    "credits": 1.0,
                    "notes": [],
                },
                {
                    "courseCode": "SCI002",
                    "semesterLabel": "Semester 2",
                    "duration": "Full Year",
                    "gradeLevels": [9, 10],
                    "prerequisites": [],
                    "creditType": "Honors Biological Science, Honors Physical Science",
                    "credits": 1.0,
                    "notes": [],
                },
            ],
            "notes": [],
            "sourceReference": "page 99",
        }
        result = finalizer._finalize_course(course)
        self.assertEqual(result["creditType"], "Honors")
        self.assertEqual(sorted(result["fulfillsRequirements"]), ["Biology", "Physical Science"])
        self.assertEqual(self._validate(result), [])

    def test_credit_type_embedded_requirement_rejected_by_validator(self):
        """A creditType that still contains a requirement name is not schema-valid."""
        course = {
            "title": "Biology",
            "department": "Science",
            "description": "A course with an unnormalized creditType.",
            "creditType": "College Prep Biological Science",
            "credits": 1.0,
            "gpaWaiverOption": False,
            "fulfillsRequirements": ["Biology"],
            "offerings": [
                {
                    "courseCode": "SCI001",
                    "semesterLabel": "Semester 1",
                    "duration": "Full Year",
                    "gradeLevels": [9, 10],
                    "prerequisites": [],
                }
            ],
            "sourceReference": "page 99",
        }
        errors = self._validate(course)
        self.assertTrue(any("creditType must be a known academic weight" in e for e in errors))

    def test_idempotent_second_pass(self):
        first = finalizer._finalize_course(copy.deepcopy(MIXED_CREDIT_COURSE))
        second = finalizer._finalize_course(copy.deepcopy(first))
        self.assertEqual(first, second)
        self.assertEqual(self._validate(second), [])

    def test_invalid_output_not_persisted(self):
        """A file that fails validation should not be overwritten with invalid data."""
        # A course with a missing title cannot be fixed by the finalizer, so the
        # validation step must prevent the file from being written.
        bad_data = {
            "courses": [
                {
                    "title": "",
                    "department": "Test",
                    "description": "A course with no title.",
                    "offerings": [
                        {
                            "courseCode": "BAD001",
                            "semesterLabel": "Semester 1",
                            "duration": "One Semester",
                            "gradeLevels": [9],
                            "prerequisites": [],
                        }
                    ],
                }
            ]
        }

        with tempfile.NamedTemporaryFile("w+", suffix=".json", delete=False) as fh:
            json.dump(bad_data, fh)
            tmp_path = Path(fh.name)

        try:
            original_text = tmp_path.read_text(encoding="utf-8")
            _, _, _, errors, written = finalizer._process_file(tmp_path)
            self.assertTrue(errors)
            self.assertFalse(written)
            self.assertEqual(tmp_path.read_text(encoding="utf-8"), original_text)
        finally:
            tmp_path.unlink()


if __name__ == "__main__":
    unittest.main()
