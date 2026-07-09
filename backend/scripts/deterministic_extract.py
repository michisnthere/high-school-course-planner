#!/usr/bin/env python3
"""
Deterministic course and requirement extraction from raw coursebook text.
Uses validated Phase 1 extraction rules without API calls.
"""
import re
import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

# Title scanning patterns for explicit course-level requirement tags.
_TITLE_REQUIREMENT_PATTERNS = [
    (re.compile(r"\bBiology\b", re.IGNORECASE), "Biology"),
    (re.compile(r"\bPhysical Science\b", re.IGNORECASE), "Physical Science"),
    (re.compile(r"\bU\.?S\.?\s*History\b", re.IGNORECASE), "U.S. History"),
    (re.compile(r"\bWorld History and Geography\b", re.IGNORECASE), "World History and Geography"),
    (re.compile(r"\bGovernment\b", re.IGNORECASE), "Government"),
    (re.compile(r"\b(?:macro|micro)?economics\b|\bPersonal Finance\b", re.IGNORECASE), "Economics or Personal Finance"),
    (re.compile(r"\bHealth\b", re.IGNORECASE), "Health"),
    (re.compile(r"\bDriver Education\b", re.IGNORECASE), "Driver Education"),
    (re.compile(r"\bPhysical Education\b", re.IGNORECASE), "Physical Education"),
    (re.compile(r"\bFine Arts\b", re.IGNORECASE), "Fine Arts"),
]

# Explicit "does not satisfy" statements override positive signals.
_NEGATIVE_REQUIREMENT_PATTERNS = [
    (re.compile(r"does not satisfy the life science graduation requirement", re.IGNORECASE), "Biology"),
    (re.compile(r"does not satisfy the physical science graduation requirement", re.IGNORECASE), "Physical Science"),
    (re.compile(r"does not satisfy the .*government graduation requirement", re.IGNORECASE), "Government"),
]

class CourseExtractor:
    """Extract course information from coursebook raw text using validated rules."""
    
    # Common OCR artifacts to fix
    OCR_FIXES = {
        'â€™': "'",      # right single quotation
        'â€œ': '"',      # left double quotation
        'â€\x9d': '"',   # right double quotation
        'â€\x9c': '"',   # left double quotation
        'so/f_tware': 'software',
        'eﬀ': 'eff',
        'ﬀ': 'ff',
    }
    
    def __init__(self, page_num: int, raw_text: str):
        self.page_num = page_num
        self.raw_text = self._clean_ocr(raw_text)
        self.courses = []
        self.departments = []
        self.graduation_requirements = []
        self.warnings = []
    
    def _clean_ocr(self, text: str) -> str:
        """Apply OCR fixes to text."""
        for pattern, replacement in self.OCR_FIXES.items():
            text = text.replace(pattern, replacement)
        return text
    
    # Department-level defaults for graduation requirements.
    DEPARTMENT_REQUIREMENT_DEFAULTS = {
        'Mathematics': 'Mathematics',
        'English': 'English',
        'Physical Education': 'Physical Education',
        'Health Education': 'Health',
        'Driver Education': 'Driver Education',
        'Visual Arts': 'Fine Arts',
        'Music': 'Fine Arts',
        'Theatre': 'Fine Arts',
        'Dance': 'Fine Arts',
    }

    def _normalize_credit_type(self, ct: str) -> tuple[str, list[str]]:
        """Normalize creditType to an academic weight and extract graduation requirements."""
        if not ct:
            return ct, []
        ct = ct.strip()
        ct_lower = ct.lower()

        # Known academic weights.
        weights = ('College Prep', 'Accelerated', 'Honors', 'AP')
        weight = None
        for w in weights:
            if w.lower() in ct_lower:
                weight = w
                break

        # Extract requirement phrases embedded in the creditType.
        req_map = {
            'Biological Science': 'Biology',
            'Physical Science': 'Physical Science',
        }
        requirements = []
        for token, req_name in req_map.items():
            if token.lower() in ct_lower:
                requirements.append(req_name)

        # Fallback: if no known weight is found, keep the original title casing.
        if weight is None:
            weight = ' '.join(word.capitalize() for word in ct.split())
        return weight, requirements
    
    def extract(self) -> Dict[str, Any]:
        """Extract all course and requirement data from the raw text."""
        self._extract_departments()
        self._extract_courses()
        self._extract_graduation_requirements()
        
        return {
            'sourcePage': self.page_num,
            'departments': self.departments,
            'courses': self.courses,
            'graduationRequirements': self.graduation_requirements,
            'warnings': self.warnings
        }
    
    def _extract_departments(self) -> None:
        """Extract department information from header patterns."""
        # Pattern: DEPARTMENT NAME (followed by course content)
        dept_pattern = r'^([A-Z][A-Z\s–\-]+?)\s+\d+\s*\n'
        
        matches = re.finditer(dept_pattern, self.raw_text, re.MULTILINE)
        dept_names = set()
        
        for match in matches:
            dept_name = match.group(1).strip()
            if len(dept_name) > 3 and dept_name not in dept_names:
                dept_names.add(dept_name)
                # Check if there's descriptive text after the header
                start_pos = match.end()
                end_pos = self.raw_text.find('\n', start_pos)
                desc_text = self.raw_text[start_pos:end_pos].strip() if end_pos > 0 else None
                
                # If the next text is ALL CAPS and multi-word, it's likely description
                if desc_text and len(desc_text) > 20 and desc_text.isupper():
                    # Continue reading description until next course or section
                    while end_pos > 0 and len(desc_text) < 500:
                        next_end = self.raw_text.find('\n', end_pos + 1)
                        next_line = self.raw_text[end_pos+1:next_end].strip() if next_end > 0 else ''
                        if not next_line or re.match(r'^[A-Z][A-Z\s–\-]*\d+', next_line):
                            break
                        if next_line.isupper():
                            desc_text += ' ' + next_line
                        end_pos = next_end
                else:
                    desc_text = None
                
                self.departments.append({
                    'name': dept_name,
                    'description': desc_text
                })
    
    def _extract_courses(self) -> None:
        """Extract individual courses from the raw text."""
        # Pattern: COURSE TITLE (in title case, possibly with course codes)
        # Followed by course metadata and description
        
        # Split by likely course boundaries (course code patterns)
        course_pattern = r'^[A-Z][A-Z0-9\-\s]+?\s*\n(?:GPA WAIVER OPTION|DUAL CREDIT|ARTICULATED CREDIT)?\s*\n?([A-Z]{2,})\d+[–\-]'
        
        sections = re.split(r'(?=^[A-Z]{2,}\d+[–\-])', self.raw_text, flags=re.MULTILINE)
        
        for section in sections:
            if len(section.strip()) < 50:
                continue
                
            try:
                course = self._parse_course_section(section)
                if course:
                    self.courses.append(course)
            except Exception as e:
                self.warnings.append(f'Failed to parse course section: {str(e)[:100]}')
    
    def _parse_course_section(self, section: str) -> Optional[Dict[str, Any]]:
        """Parse a single course section into structured course data."""
        lines = section.strip().split('\n')
        if len(lines) < 3:
            return None
        
        # First line is usually course title
        title = lines[0].strip().title()
        
        # Extract GPA waiver option
        gpa_waiver = 'GPA WAIVER OPTION' in section
        
        # Extract course codes and metadata
        offerings = []
        course_code_pattern = r'([A-Z]{2,})(\d+).*?(Semester|One Semester|Full Year)'
        
        matches = list(re.finditer(course_code_pattern, section))
        if not matches:
            return None
        
        # Extract description (usually after metadata)
        desc_match = re.search(r'(?:Credit:|credit:)\s*(.+?)\n\n(.+?)(?=\n[A-Z]{2,}\d+|$)', section, re.DOTALL)
        description = None
        credit_type = 'College Prep'  # default
        
        fulfills_requirements = []
        if desc_match:
            raw_credit_type = desc_match.group(1).strip()
            credit_type, extracted_reqs = self._normalize_credit_type(raw_credit_type)
            fulfills_requirements.extend(extracted_reqs)
            description = ' '.join(desc_match.group(2).split())[:500]  # limit length

        # Credits belong to the course, not to individual offerings.
        credits = self._extract_credits(section, description or '')

        # Parse each offering (semester-specific scheduling data only)
        for match in matches:
            prefix = match.group(1)
            code = match.group(2)
            duration = match.group(3)

            offering = {
                'courseCode': f'{prefix}{code}',
                'semesterLabel': duration,
                'duration': self._parse_duration(duration),
                'gradeLevels': self._extract_grade_levels(section),
                'prerequisites': self._extract_prerequisites(section),
            }
            offerings.append(offering)

        if not offerings:
            return None

        department = self._find_department() or None

        # Apply department-level safe defaults for graduation requirements.
        if department in self.DEPARTMENT_REQUIREMENT_DEFAULTS:
            default = self.DEPARTMENT_REQUIREMENT_DEFAULTS[department]
            if default not in fulfills_requirements:
                fulfills_requirements.append(default)

        # Add explicit requirement tags from the course title.
        for pattern, req_name in _TITLE_REQUIREMENT_PATTERNS:
            if pattern.search(title) and req_name not in fulfills_requirements:
                fulfills_requirements.append(req_name)

        # Remove requirements explicitly negated by catalog text.
        removals = []
        full_text = " ".join(filter(None, [title, description])) or ""
        for pattern, req_name in _NEGATIVE_REQUIREMENT_PATTERNS:
            if pattern.search(full_text) and req_name in fulfills_requirements:
                removals.append(req_name)
        for req_name in removals:
            fulfills_requirements.remove(req_name)

        result = {
            'title': title,
            'department': department,
            'description': description,
            'creditType': credit_type,
            'credits': credits,
            'gpaWaiverOption': gpa_waiver,
            'fulfillsRequirements': fulfills_requirements,
            'offerings': offerings,
            'sourceReference': f'Page {self.page_num}'
        }
        notes = self._extract_notes(section)
        if notes:
            result['notes'] = notes
        return result
    
    def _parse_duration(self, duration_str: str) -> str:
        """Parse duration string."""
        if 'Full' in duration_str:
            return 'Full Year'
        return 'One Semester'
    
    def _extract_grade_levels(self, section: str) -> List[int]:
        """Extract grade levels from 'Open to:' pattern."""
        match = re.search(r'Open to:\s*(\d+(?:\-\d+)*)', section)
        if match:
            grade_str = match.group(1)
            grades = []
            for part in grade_str.split('-'):
                try:
                    grades.append(int(part))
                except ValueError:
                    pass
            return sorted(set(grades)) if grades else []
        return []
    
    def _extract_prerequisites(self, section: str) -> List[str]:
        """Extract prerequisites from section."""
        prereq_match = re.search(r'Prerequisite[s]?:\s*(.+?)(?=\nCredit|$)', section, re.DOTALL)
        if prereq_match:
            prereq_text = prereq_match.group(1).strip()
            if prereq_text.lower() != 'none':
                # Clean up the prerequisite text
                prereq_text = re.sub(r'\n+', ' ', prereq_text)
                return [prereq_text]
        return []
    
    def _extract_credits(self, section: str, description: str) -> float:
        """Extract or infer credits."""
        # Check for explicit credit amount
        credit_match = re.search(r'credits?\s*:\s*(\d+(?:\.\d+)?)', section, re.IGNORECASE)
        if credit_match:
            return float(credit_match.group(1))
        
        # Apply 1.5 rule for AP sciences with Early Bird/1.5 period indicator
        if ('1.5 period' in description or 'In this 1.5 period' in description) and 'AP' in section:
            return 1.5
        
        # Default inference
        self.warnings.append('Credits inferred as 1.0 (not printed on page).')
        return 1.0
    
    def _extract_notes(self, section: str) -> List[str]:
        """Extract special notes from section."""
        notes = []
        # Look for "Note:" patterns
        note_matches = re.findall(r'Note[s]?:\s*(.+?)(?=\n[A-Z]|\nThis|$)', section, re.DOTALL)
        for match in note_matches:
            note_text = ' '.join(match.split())[:200]
            notes.append(note_text)
        return notes
    
    def _extract_graduation_requirements(self) -> None:
        """Extract graduation requirements if this is a policy page."""
        # Look for requirement headers
        req_pattern = r'^([A-Z][A-Z\s]+?)\s+GRADUATION REQUIREMENT[S]?'
        
        matches = re.finditer(req_pattern, self.raw_text, re.MULTILINE)
        for match in matches:
            req_name = match.group(1).strip()
            
            # Extract the requirement text
            start = match.start()
            end = self.raw_text.find('\n\n', start + 100)
            if end < 0:
                end = len(self.raw_text)
            
            req_text = self.raw_text[start:end]
            
            # Parse into requirement record
            req = {
                'name': req_name,
                'category': 'Graduation Requirement',
                'requirementType': 'completion',
                'requiredValue': None,
                'eligibleCourses': [],
                'waiverRules': [],
                'notes': [' '.join(req_text.split())[100:400]],
                'sourceReference': f'Graduation Requirements (page {self.page_num})'
            }
            
            # Try to extract numeric requirement
            num_match = re.search(r'(\d+)\s*(?:credits?|semesters?)', req_text)
            if num_match:
                req['requiredValue'] = float(num_match.group(1))
                if 'semester' in req_text.lower():
                    req['requirementType'] = 'semesters'
                elif 'credit' in req_text.lower():
                    req['requirementType'] = 'credits'
            
            self.graduation_requirements.append(req)
    
    def _find_department(self) -> Optional[str]:
        """Find the department name for this course section."""
        if self.departments:
            return self.departments[-1]['name']
        return None


def process_page(page_num: int) -> Optional[Dict[str, Any]]:
    """Extract structured data from a page."""
    raw_text_path = Path(f'data/raw-text/page-{page_num:03d}.txt')
    
    if not raw_text_path.exists():
        return None
    
    try:
        with open(raw_text_path, 'r', encoding='utf-8') as f:
            raw_text = f.read()
        
        extractor = CourseExtractor(page_num, raw_text)
        return extractor.extract()
    except Exception as e:
        print(f'Error processing page {page_num}: {e}', file=sys.stderr)
        return None


if __name__ == '__main__':
    # Test on page 18
    result = process_page(18)
    if result:
        print(json.dumps(result, indent=2))
