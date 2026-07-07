"""Build language_learning page and section JSON from extracted raw text."""
from __future__ import annotations

import json
from pathlib import Path

PAGE_DIR = Path("extractor/page_output")
SECTION_DIR = Path("extractor/section_output")


def page_json(departments=None, courses=None, warnings=None):
    return {
        "departments": departments or [],
        "courses": courses or [],
        "graduationRequirements": [],
        "warnings": warnings or [],
    }


def offering(course_code, semester, credit_type, duration="full year", grades=None, prereqs=None):
    return {
        "courseCode": course_code,
        "semesterLabel": semester,
        "duration": duration,
        "gradeLevels": grades or [9, 10, 11, 12],
        "prerequisites": prereqs or [],
        "corequisites": [],
        "creditType": credit_type,
        "credits": 1.0,
    }


def course(title, dept, description, credit_type, page, offerings, notes=None, gpa=None, is_online=False):
    if gpa is None:
        gpa = credit_type == "College Prep"
    obj = {
        "title": title,
        "department": dept,
        "description": description,
        "gpaWaiverOption": gpa,
        "isOnline": is_online,
        "offerings": offerings,
        "sourceReference": f"page {page}",
    }
    if notes:
        obj["notes"] = notes
    return obj


# Department overview for page 71
page_71 = page_json(
    departments=[
        {
            "name": "Multilingual Learning",
            "description": "Multilingual Learning: Your Key to the World — Opening Doors. Opening Minds. To meet the aims and purpose of multilingual learning instruction, it is recommended that students take two to five years of a language. Many colleges and universities require a two- to four-year sequence in one language. A placement exam must be taken by all incoming freshmen and transfer students who have prior experience in Spanish, French, German, Mandarin Chinese, Hebrew or Latin. By meeting proficiency standards in the placement exam, the student will be placed in the appropriate second year course. Students who have developed proficiency in a language through life experience, rather than through formal study, may be placed by examination into the most appropriate language course for their skill level. However, no transcript credit for earlier courses in that language will be awarded. Prior credit approval from the Multilingual Learning Director is needed before enrolling in courses for external credit. Please refer to the “External Credits” section of the coursebook. Language Learning courses satisfy the graduation requirement for elective credits.",
            "director": "Justin Fisk",
            "directorEmail": "jfisk@d125.org",
            "directorPhone": "847-415-4700",
            "subDepartments": ["Language Learning", "English Language Development"],
        }
    ]
)

# Course offerings diagram pages 72 and 73
page_72 = page_json(
    warnings=[
        "Course offerings diagram only; no course records extracted. Diagram showed: French 1 (FRE101/FRE102), French 2 (FRE211/FRE212), French 3 (FRE311/FRE312), AP French Language (FRE601/FRE602), German 1 (GRE101/GRE102), German 2 (GRE211/GRE212), German 3 (GRE311/GRE312), AP German Language and Culture (GRE601/GRE602), Hebrew 1 (HBR101/HBR102), Hebrew 2 (HBR211/HBR212), Hebrew 3 (HBR311/HBR312), Hebrew 4 (HBR411/HBR412), Latin 1 (LAT101/LAT102), Latin 2 (LAT211/LAT212), Latin 3 (LAT311/LAT312), AP Latin (LAT621/LAT622)."
    ]
)

page_73 = page_json(
    warnings=[
        "Course offerings diagram only; no course records extracted. Diagram showed: AP Spanish Literature and Culture (SPA611/SPA612), Mandarin Chinese 1 (CHI101/CHI102), Mandarin Chinese 2 (CHI211/CHI212), Mandarin Chinese 3 (CHI311/CHI312), Mandarin Chinese 4 (CHI411/CHI412), AP Chinese Language and Culture (CHI601/CHI602), Chinese Literature, Media and Culture (CHI611/CHI612), Intermediate Mandarin Chinese Language Arts (CHI351/CHI352), Spanish 1 (SPA101/SPA102), Spanish 2 (SPA201/SPA202), Spanish 2-3 (SPA211/SPA212), Spanish 3 (SPA301/SPA302), Spanish 3-4 (SPA311/SPA312), Spanish 4 (SPA401/SPA402), AP Spanish Language and Culture (SPA601/SPA602), Advanced Spanish Conversation and Culture (SPA511/SPA512), Intermediate Spanish Language Arts (SPA351/SPA352)."
    ]
)

# Page 74 French
courses_74 = [
    course(
        "French 1",
        "French",
        "Students begin to develop their competence in French across three modes of communication: interpersonal, presentational and interpretative. They will explore the language in the context of six AP themes: Global Challenges, Science and Technology, Contemporary Life, Personal and Public Identities, Families and Communities and Beauty and Aesthetics. Performance-based assessments in the presentational and interpersonal modes (speaking and writing) provide the students the opportunity to use the language in practiced, familiar contexts. Interpretive listening and reading tasks are focused on the acquisition and recognition of basic stated information in the target language. Additionally, students explore the cultures of the French-speaking world, making comparisons and connections with their own experiences. Communication in class (teacher-student and/or student-student) is primarily in French.",
        "College Prep",
        74,
        [
            offering("FRE101", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
            offering("FRE102", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
        ],
    ),
    course(
        "French 2",
        "French",
        "This course is the first in the three-year accelerated sequence that prepares students for AP French Language. Students continue to develop their competence in French across the three modes of communication in the context of the six AP themes. Performance-based assessments in the interpersonal and presentational modes (speaking and writing) provide the students the opportunity to use the language in practiced, familiar contexts as well as occasional, unfamiliar topics with increasing independence. Interpretive listening and reading is focused on the recognition of key details and making inferences about the content of authentic sources. Students continue to explore the cultures of the French-speaking world in new contexts. Communication in class (teacher-student and/or student-student) is primarily in French.",
        "Accelerated",
        74,
        [
            offering("FRE211", "SEMESTER 1", "Accelerated", grades=[9, 10, 11, 12], prereqs=["French 1 or passing the placement exam for French 2 and approval of director"]),
            offering("FRE212", "SEMESTER 2", "Accelerated", grades=[9, 10, 11, 12], prereqs=["French 1 or passing the placement exam for French 2 and approval of director"]),
        ],
    ),
    course(
        "French 3",
        "French",
        "This course is the second in the three-year accelerated sequence that prepares students for AP French Language. Students continue to develop their competence in French across the three modes of communication in the context of the six AP themes. Performance-based assessments in the interpersonal and presentational modes (speaking and writing) provide the students the opportunity to use French independently in familiar contexts, with the increasing ability to use the language in unfamiliar contexts. Interpretive listening and reading tasks are focused on both literal comprehension and inferential interpretation. Throughout the course, students continue to explore the cultures of the French-speaking world in new contexts. In this course, students also read authentic literature including poems, short stories and excerpts from novels. Communication in class (teacher-student and/or student-student) is entirely in French.",
        "Accelerated",
        74,
        [
            offering("FRE311", "SEMESTER 1", "Accelerated", grades=[10, 11, 12], prereqs=["French 2 or passing the placement exam for French 3 and approval of director"]),
            offering("FRE312", "SEMESTER 2", "Accelerated", grades=[10, 11, 12], prereqs=["French 2 or passing the placement exam for French 3 and approval of director"]),
        ],
        notes=["Dual Credit Available with Loyola University Chicago."],
    ),
    course(
        "AP French Language",
        "French",
        "Students continue to work to develop their competence across the three modes of communication in the context of the six AP themes, as they simultaneously prepare for the AP French Language and Culture exam. Performance-based assessments (speaking and writing) provide the students the opportunity to use the language independently in unfamiliar contexts. Interpretive listening and reading tasks involve authentic sources designed for native speakers and are focused on both literal comprehension and inferential interpretation. A variety of authentic print, audio and video materials provide the basis for exploration of the cultures of the French-speaking world. Tasks involve students analyzing and making comparisons with their own cultural products, practices and perspectives. Communication in class (teacher-student and/or student-student) is entirely in French. Students who enroll in this course will be prepared to take the AP French Language and Culture exam in May.",
        "Honors",
        74,
        [
            offering("FRE601", "SEMESTER 1", "Honors", grades=[11, 12], prereqs=["French 3 or passing the placement exam for AP French Language and approval of director"]),
            offering("FRE602", "SEMESTER 2", "Honors", grades=[11, 12], prereqs=["French 3 or passing the placement exam for AP French Language and approval of director"]),
        ],
    ),
]

# Page 75 German
courses_75 = [
    course(
        "German 1",
        "German",
        "German 1 is an introduction to German language and culture. Students begin to develop their competence in German across the three modes of communication: interpersonal, presentational and interpretative in the context of the following AP themes: Contemporary Life and Personal and Public Identities. Performance-based assessments in the presentational and interpersonal modes provide the students the opportunity to use the language in practiced, familiar contexts. Interpretive listening and reading tasks are focused on the acquisition and recognition of basic stated information in the target language. By the end of the course, students will be able to communicate in German in a basic way in familiar contexts. Moreover, they will be able to read and understand short stories in German. Additionally, students will explore the target culture, make comparisons and connections with their own experiences and come to view language learning as a lifelong pursuit. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in German. This is the first course in a four course sequence that prepares students for AP German Language and Culture.",
        "College Prep",
        75,
        [
            offering("GRE101", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
            offering("GRE102", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
        ],
    ),
    course(
        "German 2",
        "German",
        "Students continue to work to develop their competence in German across the three modes of communication in the context of the following AP themes: Contemporary Life, Families and Communities and Science and Technology. Performance-based assessments in the presentational and interpersonal modes provide the students the opportunity to use the language in practiced, familiar contexts with increasing independence. Moreover, they will be able to read and understand more complex stories in German. Interpretive listening and reading are focused on the acquisition and recognition of key details in the target language. Students continue to explore the target culture in new contexts. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in German. This is the second course in a four course sequence that prepares students for AP German Language and Culture.",
        "Accelerated",
        75,
        [
            offering("GRE211", "SEMESTER 1", "Accelerated", grades=[9, 10, 11, 12], prereqs=["German 1 or passing the placement exam for German 2 and approval of director"]),
            offering("GRE212", "SEMESTER 2", "Accelerated", grades=[9, 10, 11, 12], prereqs=["German 1 or passing the placement exam for German 2 and approval of director"]),
        ],
    ),
    course(
        "German 3",
        "German",
        "This course, which moves at a faster pace than German 2, begins preparation for the AP German Language and Culture Exam. Students continue to work to develop their competence in German across the three modes of communication in the context of the six AP themes: Global Challenges, Science and Technology, Contemporary Life, Personal and Public Identities, Families and Communities, and Beauty and Aesthetics. Performance-based assessments in the presentational and interpersonal modes provide the students the opportunity to use the language in familiar contexts independently. Additionally, authentic materials will expand their German knowledge. Interpretive listening and reading tasks are focused on literal comprehension with increasing emphasis on inferential interpretation. Students continue to explore the target culture in new contexts. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in German. This is the third course in a four course sequence that prepares students for AP German Language and Culture.",
        "Accelerated",
        75,
        [
            offering("GRE311", "SEMESTER 1", "Accelerated", grades=[10, 11, 12], prereqs=["German 2 or passing the placement exam for German 3 and approval of director"]),
            offering("GRE312", "SEMESTER 2", "Accelerated", grades=[10, 11, 12], prereqs=["German 2 or passing the placement exam for German 3 and approval of director"]),
        ],
        notes=["Dual Credit Available with Loyola University Chicago."],
    ),
    course(
        "AP German Language and Culture",
        "German",
        "This AP German course is designed for motivated students who have successfully finished three years of German and who are interested in taking a higher level German course. It is aimed to prepare students who are interested in taking the AP German Language and Culture exam and/or in furthering their study in the German language and culture. Special emphasis is placed on the use of authentic source materials related to culture and current events and the integration of language skills. Specific work includes: analysis of articles and literature, formal and informal oral presentations, formal and informal writings, a variety of audios/videos related to conversations, announcements, news reports or academic or cultural topics related to the German-speaking world. The expectation is that all communication in the classroom (teacher-student and/or student-student) take place in German. Students who enroll in this course will be prepared to take the AP German Language and Culture exam in May.",
        "Honors",
        75,
        [
            offering("GRE601", "SEMESTER 1", "Honors", grades=[11, 12], prereqs=["German 3 or passing the placement exam for AP German and approval of director"]),
            offering("GRE602", "SEMESTER 2", "Honors", grades=[11, 12], prereqs=["German 3 or passing the placement exam for AP German and approval of director"]),
        ],
    ),
]

# Page 76 Hebrew
courses_76 = [
    course(
        "Hebrew 1",
        "Hebrew",
        "Hebrew 1 is an introduction to the Hebrew language and Israeli culture. Students develop their competencies across three modes of communication: interpersonal, presentational and interpretative. Students become comfortable reading the print form of the Hebrew alphabet that appears in books and also learn the script form for writing. The course explores the language in the context of the six AP themes: Global Challenges, Science and Technology, Contemporary Life, Personal and Public Identities, Families and Communities and Beauty and Aesthetics. Performance-based assessments in the interpersonal, presentational and interpretive modes provides students with the opportunity to use the language in practiced, familiar contexts. Interpretive listening and reading tasks focus on the acquisition and recognition of basic stated information in Hebrew. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Hebrew. Additionally, students explore Israeli culture, make comparisons and connections with their own experiences and come to view language learning as a lifelong pursuit.",
        "College Prep",
        76,
        [
            offering("HBR101", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
            offering("HBR102", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
        ],
    ),
    course(
        "Hebrew 2",
        "Hebrew",
        "Students continue to develop their competence in Hebrew across the three modes of communication: interpersonal, presentational and interpretive. Students also continue to learn in the context of the six AP themes: Global Challenges; Science and Technology; Contemporary Life; Personal and Public Identities, Families and Communities and Beauty and Aesthetics. Performance-based assessments provide the opportunity to use the language in practiced, familiar contexts with increasing independence. Interpretive listening and reading activities are focused on the acquisition and recognition of key details in Hebrew. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Hebrew. Additionally, students explore Israeli culture through a variety of contexts and authentic materials, such as short stories, essays, poems, songs, news reports, advertising and video clips from Israel.",
        "Accelerated",
        76,
        [
            offering("HBR211", "SEMESTER 1", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Hebrew 1 or passing the placement exam for Hebrew 2 and approval of director"]),
            offering("HBR212", "SEMESTER 2", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Hebrew 1 or passing the placement exam for Hebrew 2 and approval of director"]),
        ],
    ),
    course(
        "Hebrew 3",
        "Hebrew",
        "Students continue to develop their competence in Hebrew across the three modes of communication: interpersonal, presentational and interpretive in a near-immersion environment. Students also continue to learn in the context of the six AP themes: Global Challenges, Science and Technology, Contemporary Life, Personal and Public Identities, Families and Communities and Beauty and Aesthetics. Performance-based assessments provide us the opportunity to use the language independently in familiar contexts. Interpretive listening and reading activities are focused on the ability to interpret and infer meaning in Hebrew. Practice is provided regularly, both within the classroom and at home. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Hebrew. Students continue to explore Israeli culture through a variety of contexts and authentic materials, such as short stories, essays, poems, songs, news reports, advertising, art, video clips and movies from Israel.",
        "Accelerated",
        76,
        [
            offering("HBR311", "SEMESTER 1", "Accelerated", grades=[10, 11, 12], prereqs=["Hebrew 2 or passing the placement exam for Hebrew 3 and approval of director"]),
            offering("HBR312", "SEMESTER 2", "Accelerated", grades=[10, 11, 12], prereqs=["Hebrew 2 or passing the placement exam for Hebrew 3 and approval of director"]),
        ],
    ),
    course(
        "Hebrew 4",
        "Hebrew",
        "Students develop their competence in Hebrew and engage in higher-level reading, writing, listening and speaking activities that align with the interpersonal, presentational and interpretive modes of communication in an immersion environment. Students continue to learn in the context of the six AP themes: Global Challenges, Science and Technology, Contemporary Life, Personal and Public Identities, Families and Communities and Beauty and Aesthetics. Performance-based assessments provide the opportunity to use the language independently even in unfamiliar contexts. Interpretive listening and reading activities are focused on both literal comprehension and inferential interpretation of the language. In Hebrew 4, classroom discussions and debates are led by the students. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Hebrew. Israeli culture continues to be explored through a variety of contexts and authentic materials, such as short stories, essays, poems, songs, print and broadcast news reports, advertising, art, video-clips, popular TV sitcoms and movies from Israel.",
        "Accelerated",
        76,
        [
            offering("HBR411", "SEMESTER 1", "Accelerated", grades=[11, 12], prereqs=["Hebrew 3 or passing the placement exam for Hebrew 4 and approval of director"]),
            offering("HBR412", "SEMESTER 2", "Accelerated", grades=[11, 12], prereqs=["Hebrew 3 or passing the placement exam for Hebrew 4 and approval of director"]),
        ],
    ),
]

# Page 77 Latin and Mandarin 1
courses_77 = [
    course(
        "Latin 1",
        "Latin",
        "Latin 1 focuses on learning the basics of Latin grammar, syntax and vocabulary. This course is designed to enable students to read materials in Latin with ease and understanding and to write original Latin sentences employing the vocabulary and grammatical structures learned. Additionally, basic prefixes, suffixes and roots of vocabulary words and word families will be studied. This class will also cover topics in Roman history, mythology and culture.",
        "College Prep",
        77,
        [
            offering("LAT101", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
            offering("LAT102", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
        ],
    ),
    course(
        "Latin 2",
        "Latin",
        "Latin 2 focuses on refining students’ knowledge of grammar and syntax from Latin 1 in order to facilitate the translation of more complex passages. Readings will focus on daily life in Rome, mythology and the heroic ideal. In addition, students will complete a semester of vocabulary study based on Latin roots, which is designed to increase students’ English vocabulary. Students will also study prescription writing in Latin abbreviations, Latin in modern law and Latin in medicine and anatomy.",
        "Accelerated",
        77,
        [
            offering("LAT211", "SEMESTER 1", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Latin 1 or passing the placement exam for Latin 2 and approval of director"]),
            offering("LAT212", "SEMESTER 2", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Latin 1 or passing the placement exam for Latin 2 and approval of director"]),
        ],
    ),
    course(
        "Latin 3",
        "Latin",
        "Students will explore various selections of Latin literature. Students will continue to refine their skills in literal translation, sight translation, scansion and literary analysis both in the target language and in English in order to facilitate greater fluency in the reading of Latin literature. Authors that will be studied include Ovid, Catullus, Cicero, Plautus and Caesar. Caesar is studied in order to provide a bridge to advanced placement in fourth year.",
        "Accelerated",
        77,
        [
            offering("LAT311", "SEMESTER 1", "Accelerated", grades=[10, 11, 12], prereqs=["Latin 2 or passing the placement exam for Latin 3 and approval of director"]),
            offering("LAT312", "SEMESTER 2", "Accelerated", grades=[10, 11, 12], prereqs=["Latin 2 or passing the placement exam for Latin 3 and approval of director"]),
        ],
        notes=["Dual Credit Available with Loyola University Chicago."],
    ),
    course(
        "AP Latin",
        "Latin",
        "Students will complete preparation for the AP Latin exam. Students will continue to refine reading, writing, listening and speaking skills. Training in translation, meter and poetic devices involved in the study of major Latin works of literature will be stressed. The students will become more comfortable in the reading and interpretation of Vergil’s Aeneid and Caesar’s De Bello Gallico. To achieve this endeavor, both the cultural component (history, politics, social structure and art) and the linguistic aspect (grammar, vocabulary and structure) will be emphasized. Students proceeding to AP Latin will be provided with summer readings by the classroom instructor. Students who enroll in this course will be prepared to take the AP Latin exam in May.",
        "Honors",
        77,
        [
            offering("LAT621", "SEMESTER 1", "Honors", grades=[11, 12], prereqs=["Latin 3 and approval of director"]),
            offering("LAT622", "SEMESTER 2", "Honors", grades=[11, 12], prereqs=["Latin 3 and approval of director"]),
        ],
        notes=["Dual Credit Available with Loyola University Chicago."],
    ),
    course(
        "Mandarin Chinese 1",
        "Mandarin Chinese",
        "Mandarin Chinese 1 is an introduction to Chinese language and culture. It is designed for students who are not heritage/native speakers*. Students begin to develop their competence in Chinese across the three modes of communication: interpersonal, presentational and interpretative in the context of the following global themes: Contemporary Life, Personal and Public Identities, Families and Communities and Beauty and Aesthetics. Performance-based assessments in the presentational and interpersonal modes provide the students the opportunity to use the language in practiced, familiar contexts. Interpretive listening and reading tasks are focused on the acquisition and recognition of basic stated information in the target language. By the end of the course, students will be able to communicate in Mandarin (the spoken language) and Hanzi (the written language) in a basic way in familiar contexts. Additionally, students explore the target culture, make comparisons and connections with their own experiences and come to view language learning as a lifelong pursuit. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Mandarin. * There is a placement exam for heritage students or students with prior knowledge that includes reading, writing and a short interview. The results from the exam will determine the appropriate course for the student.",
        "College Prep",
        77,
        [
            offering("CHI101", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
            offering("CHI102", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
        ],
    ),
]

# Page 78 Mandarin 2, 3, Intermediate Language Arts, 4
courses_78 = [
    course(
        "Mandarin Chinese 2",
        "Mandarin Chinese",
        "In this course, students continue to work to develop their competence in Chinese across the three modes of communication in the context of the following AP themes: Contemporary Life, Families and Communities, Beauty and Aesthetics and Science and Technology. Performance-based assessments in the presentational and interpersonal modes provide the students the opportunity to use the language in practiced, familiar contexts with increasing independence. Interpretive listening and reading are focused on the acquisition and recognition of key details in the target language. Students continue to explore the target culture in new contexts. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Mandarin.",
        "Accelerated",
        78,
        [
            offering("CHI211", "SEMESTER 1", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Mandarin Chinese 1 or passing the placement exam for Mandarin Chinese 2 and approval of director"]),
            offering("CHI212", "SEMESTER 2", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Mandarin Chinese 1 or passing the placement exam for Mandarin Chinese 2 and approval of director"]),
        ],
    ),
    course(
        "Mandarin Chinese 3",
        "Mandarin Chinese",
        "This course requires students to engage in interpersonal, presentational and interpretive tasks at more advanced proficiency levels. Students continue to work to develop their competence in Chinese across the three modes of communication in the context of the six AP themes. Performance-based assessments in the presentational and interpersonal modes provide the students the opportunity to use the language in familiar contexts independently. Interpretive listening and reading tasks are focused on literal comprehension with increasing emphasis on inferential interpretation. Students continue to explore the target culture in new contexts. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Mandarin.",
        "Accelerated",
        78,
        [
            offering("CHI311", "SEMESTER 1", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Mandarin Chinese 2 or passing the placement exam for Mandarin Chinese 3 and approval of director"]),
            offering("CHI312", "SEMESTER 2", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Mandarin Chinese 2 or passing the placement exam for Mandarin Chinese 3 and approval of director"]),
        ],
    ),
    course(
        "Intermediate Mandarin Chinese Language Arts",
        "Mandarin Chinese",
        "This course is designed specifically for students with lived Mandarin Chinese language experience, either from prior schooling in a Chinese-speaking country or as native/heritage speakers of Chinese. Students will develop their literacy skills in Chinese as they explore literature from the Chinese-speaking world and engage in focused development of reading and writing skills. While special focus will be placed on developing foundational literacy skills (e.g., Mandarin character decoding and character writing), students will also develop critical thinking and oracy skills in Chinese as they collaboratively explore topics related to current events, culture and media.",
        "Accelerated",
        78,
        [
            offering("CHI351", "SEMESTER 1", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Intermediate or higher proficiency in the domains of speaking and listening as demonstrated on Mandarin Chinese language proficiency assessment (e.g., AAPPL), teacher recommendation, or director approval"]),
            offering("CHI352", "SEMESTER 2", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Intermediate or higher proficiency in the domains of speaking and listening as demonstrated on Mandarin Chinese language proficiency assessment (e.g., AAPPL), teacher recommendation, or director approval"]),
        ],
    ),
    course(
        "Mandarin Chinese 4",
        "Mandarin Chinese",
        "Students continue to work to develop their competence in Mandarin Chinese across the three modes of communication in the context of the six AP themes. Performance-based assessments provide the students opportunity to use the language independently in unfamiliar contexts. Interpretive listening and reading tasks are focused on both literal and comprehension and inferential interpretation. Practice is provided regularly, both within the classroom and at home. Cultural information and comparisons are drawn from authentic print, literary works and class discussion. Students will participate in class debates and facilitate classroom discussion through their own student-led presentation. The expectation is that the communication in the classroom take place primarily in Chinese. This course begins preparation for the AP Chinese Language and Culture exam.",
        "Accelerated",
        78,
        [
            offering("CHI411", "SEMESTER 1", "Accelerated", grades=[10, 11, 12], prereqs=["Mandarin Chinese 3 or passing the placement exam for Mandarin Chinese 4 and approval of director"]),
            offering("CHI412", "SEMESTER 2", "Accelerated", grades=[10, 11, 12], prereqs=["Mandarin Chinese 3 or passing the placement exam for Mandarin Chinese 4 and approval of director"]),
        ],
        notes=["Dual Credit Available with North Central College."],
    ),
]

# Page 79 AP Chinese, Chinese Literature, Spanish 1, Spanish 2
courses_79 = [
    course(
        "AP Chinese Language and Culture",
        "Mandarin Chinese",
        "This course is designed to prepare students for the AP Chinese Language and Culture exam, i.e. a level comparable to fourth semester (or equivalent) college/university courses in Mandarin Chinese. The course focuses on language proficiency while dealing with level- and age-appropriate cultural content throughout the course. Students engage in readings, conversation and composition and research projects. The expectation is that all communication in the classroom takes place in the target language. By the end of the year, students will be able to understand the spoken language formally (lectures, news, etc.) and in conversation (dialogues…); to acquire vocabulary and structures that enable students to understand, analyze contextualized materials (advertisement, posters, newspaper, magazine articles, letters, etc.); to describe an event or activity in a cohesive and coherent manner with linguistic accuracy; to write appropriately employing the organization, vocabulary and structure appropriate to the purpose of their writing and to demonstrate cultural appropriateness through spoken and written discourse.",
        "Honors",
        79,
        [
            offering("CHI601", "SEMESTER 1", "Honors", grades=[11, 12], prereqs=["Mandarin Chinese 4, three years of high school Mandarin study, or passing the placement exam for AP Chinese Language and Culture and approval of director"]),
            offering("CHI602", "SEMESTER 2", "Honors", grades=[11, 12], prereqs=["Mandarin Chinese 4, three years of high school Mandarin study, or passing the placement exam for AP Chinese Language and Culture and approval of director"]),
        ],
    ),
    course(
        "Chinese Literature, Media and Culture",
        "Mandarin Chinese",
        "Students continue to work to develop their competence in Chinese across the three modes of communication within the context of critical analysis of literature and media, as well as a close investigation of culture and social trends. Performance-based assessments provide students the opportunity to use the language independently and collaboratively in both familiar and unfamiliar literary, media and cultural contexts. Interpretive listening, viewing and reading tasks are focused on both literal comprehension and inferential interpretation of both familiar and unfamiliar pieces of literature, media and culture. Practice is provided regularly, both within the classroom and at home. Throughout the course, students continue to explore the target culture as they are invited to situate their own experiences within new contexts.",
        "Honors",
        79,
        [
            offering("CHI611", "SEMESTER 1", "Honors", grades=[11, 12], prereqs=["AP Chinese Language and Culture or placement test"]),
            offering("CHI612", "SEMESTER 2", "Honors", grades=[11, 12], prereqs=["AP Chinese Language and Culture or placement test"]),
        ],
    ),
    course(
        "Spanish 1",
        "Spanish",
        "Students begin to develop their competence in Spanish across three modes of communication: interpersonal, presentational and interpretative. They will explore the language in the context of the six AP themes: Global Challenges, Science and Technology, Contemporary Life, Personal and Public Identities, Families and Communities, and Beauty and Aesthetics. Performance-based assessments in the presentational and interpersonal modes provide the students the opportunity to use the language in practiced, familiar contexts. Interpretive listening and reading tasks are focused on the acquisition and recognition of basic stated information in the target language. Practice is provided regularly, both within the classroom and at home. Additionally, students explore the target culture, make comparisons and connections with their own experiences and come to view language learning as a lifelong pursuit. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Spanish.",
        "College Prep",
        79,
        [
            offering("SPA101", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
            offering("SPA102", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["None"]),
        ],
    ),
    course(
        "Spanish 2",
        "Spanish",
        "Students continue to work to develop their competence in Spanish across the three modes of communication in the context of the six AP themes. Performance-based assessments provide the students the opportunity to use the language in practiced, familiar contexts with increasing independence. Interpretive listening and reading are focused on the acquisition and recognition of key details in the target language. Practice is provided regularly, both within the classroom and at home. Students continue to explore the target culture in new contexts. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Spanish.",
        "College Prep",
        79,
        [
            offering("SPA201", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["Spanish 1 or passing the placement exam for Spanish 2 and approval of director"]),
            offering("SPA202", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["Spanish 1 or passing the placement exam for Spanish 2 and approval of director"]),
        ],
    ),
]

# Page 80 Spanish 2-3, 3, 3-4, Intermediate Spanish Language Arts
courses_80 = [
    course(
        "Spanish 2-3",
        "Spanish",
        "In comparison to Spanish 2, Spanish 2-3 has a faster pace and students are asked to engage in interpersonal, presentational and interpretive tasks at more advanced proficiency levels. Students continue to work to develop their competence in Spanish across the three modes of communication in the context of the six AP themes. Performance-based assessments provide the students the opportunity to use the language in practiced, familiar contexts as well as occasional unfamiliar topics with increasing independence. Interpretive listening and reading are focused on the acquisition and recognition of key details with emerging evidence of inference making in the target language. Practice is provided regularly, both within the classroom and at home. Students continue to explore the target culture in new contexts. In this course, students also begin reading poems and short stories by authors who appear on the AP Spanish Literature and Culture reading list. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Spanish.",
        "Accelerated",
        80,
        [
            offering("SPA211", "SEMESTER 1", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Spanish 1 or passing the placement exam for Spanish 2-3 and approval of director"]),
            offering("SPA212", "SEMESTER 2", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Spanish 1 or passing the placement exam for Spanish 2-3 and approval of director"]),
        ],
    ),
    course(
        "Spanish 3",
        "Spanish",
        "Students continue to work to develop their competence in Spanish across the three modes of communication in the context of the six AP themes. Performance-based assessments provide the students the opportunity to use the language in familiar contexts independently. Interpretive listening and reading tasks are focused on literal comprehension with increasing emphasis on inferential interpretation. Practice is provided regularly, both within the classroom and at home. Students continue to explore the target culture in new contexts. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Spanish.",
        "College Prep",
        80,
        [
            offering("SPA301", "SEMESTER 1", "College Prep", grades=[10, 11, 12], prereqs=["Spanish 2"]),
            offering("SPA302", "SEMESTER 2", "College Prep", grades=[10, 11, 12], prereqs=["Spanish 2"]),
        ],
    ),
    course(
        "Spanish 3-4",
        "Spanish",
        "Students continue to work to develop their competence in Spanish across the three modes of communication in the context of the six AP themes. Performance-based assessments provide the students the opportunity to use the language independently in unfamiliar contexts. Interpretive listening and reading tasks are focused on both literal comprehension and inferential interpretation. Practice is provided regularly, both within the classroom and at home. Throughout the course, students continue to explore the target culture in new contexts. In comparison to the college prep sequence of courses, Spanish 3-4 accelerated has a faster pace and students are asked to engage in interpersonal, presentational and interpretive tasks at more advanced proficiency levels. In this course, students also continue reading authentic literature including poems, short stories and plays. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Spanish.",
        "Accelerated",
        80,
        [
            offering("SPA311", "SEMESTER 1", "Accelerated", grades=[10, 11, 12], prereqs=["Spanish 2-3 or passing the placement exam for Spanish 3-4 and approval of director"]),
            offering("SPA312", "SEMESTER 2", "Accelerated", grades=[10, 11, 12], prereqs=["Spanish 2-3 or passing the placement exam for Spanish 3-4 and approval of director"]),
        ],
    ),
    course(
        "Intermediate Spanish Language Arts",
        "Spanish",
        "This course is designed specifically for students with lived Spanish language experience, either from prior schooling in a Spanish-speaking country or as native/heritage speakers of Spanish. Students will develop their literacy skills in Spanish as they explore literature from the Spanish-speaking world and engage in focused development of writing skills. Additionally, students will develop critical thinking and oracy skills in Spanish as they collaboratively explore topics related to current events, culture and media.",
        "Accelerated",
        80,
        [
            offering("SPA351", "SEMESTER 1", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Intermediate or higher proficiency as demonstrated on Spanish language proficiency assessment (e.g., AAPPL), teacher recommendation, or director approval"]),
            offering("SPA352", "SEMESTER 2", "Accelerated", grades=[9, 10, 11, 12], prereqs=["Intermediate or higher proficiency as demonstrated on Spanish language proficiency assessment (e.g., AAPPL), teacher recommendation, or director approval"]),
        ],
    ),
]

# Page 81 Spanish 4, AP Spanish Language, AP Spanish Literature, Advanced Spanish Conversation and Culture
courses_81 = [
    course(
        "Spanish 4",
        "Spanish",
        "Students continue to work to develop their competence in Spanish across the three modes of communication in the context of the six AP themes. Performance-based assessments provide the students the opportunity to use the language independently in unfamiliar contexts. Interpretive listening and reading tasks are focused on both literal comprehension and inferential interpretation. Practice is provided regularly, both within the classroom and at home. Cultural information and comparisons are drawn from authentic print, literary works and class discussion. Students will participate in classroom debates and facilitate classroom discussion through their own student-led presentation. Upon completion of this course, students will be prepared to enter into AP Spanish Language and Culture. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place primarily in Spanish.",
        "College Prep",
        81,
        [
            offering("SPA401", "SEMESTER 1", "College Prep", grades=[11, 12], prereqs=["Spanish 3"]),
            offering("SPA402", "SEMESTER 2", "College Prep", grades=[11, 12], prereqs=["Spanish 3"]),
        ],
    ),
    course(
        "AP Spanish Language and Culture",
        "Spanish",
        "This course is designed to prepare students for the AP Spanish Language and Culture exam and provides a transition to the AP Spanish Literature and Culture course. Students continue to work to develop their competence in Spanish across the three modes of communication: interpretive, interpersonal and presentational, within the context of the six AP themes: Families and Communities, Science and Technology, Global Challenges, Contemporary Life, Personal and Public Identities, Beauty and Aesthetics. Performance-based assessments provide the students the opportunity to use the language independently in familiar and unfamiliar contexts. Interpretive listening and reading tasks are focused on both literal comprehension and inferential interpretation. Practice is provided regularly, both within the classroom and at home. Cultural information and comparisons are drawn from authentic print and audio-visual sources, literary works and class discussion. Students will research a variety of cultural topics and facilitate discussion through their own student-led presentations. The expectation is that the communication in the classroom (teacher-student and/or student-student) take place in Spanish.",
        "Honors",
        81,
        [
            offering("SPA601", "SEMESTER 1", "Honors", grades=[10, 11, 12], prereqs=["Intermediate Spanish Language Arts, Spanish 4 or Spanish 3-4"]),
            offering("SPA602", "SEMESTER 2", "Honors", grades=[10, 11, 12], prereqs=["Intermediate Spanish Language Arts, Spanish 4 or Spanish 3-4"]),
        ],
    ),
    course(
        "AP Spanish Literature and Culture",
        "Spanish",
        "This course is designed to introduce students to the formal study of Peninsular Spanish, Latin American and U.S. Hispanic literature. The course aims to develop students’ critical reading and analytical writing skills in Spanish as well as their ability to make interdisciplinary connections and explore linguistic and cultural comparisons. This course will be conducted entirely in Spanish appropriate to this level and covers the entire official AP Spanish Literature and Culture reading list. Literary texts are grouped by themes and presented in chronological order within each of the following themes: las sociedades en contacto, la construcción del género, el tiempo y el espacio, las relaciones interpersonales, la dualidad del ser and la creación literaria. Students are expected to discuss literary texts and their different historical, sociocultural and geopolitical contexts in a variety of interactive oral and written formats in Spanish. Students who enroll in this course will be prepared to take the AP Spanish Literature and Culture exam in May.",
        "Honors",
        81,
        [
            offering("SPA611", "SEMESTER 1", "Honors", grades=[11, 12], prereqs=["AP Spanish Language and Culture"]),
            offering("SPA612", "SEMESTER 2", "Honors", grades=[11, 12], prereqs=["AP Spanish Language and Culture"]),
        ],
    ),
    course(
        "Advanced Spanish Conversation and Culture",
        "Spanish",
        "Advanced conversation and culture builds upon the communicative focus in the presentational, interpretive and interpersonal modes from prior coursework, but will uniquely explore the language through a cultural lens. The aim of this course is to present how the language manifests itself in various regions of the Spanish-speaking world through both historical and contemporary settings. Students who like to travel or who are thinking about studying abroad in college will enjoy this course and the experience it will provide prior to graduation. In discovering Spanish throughout the world, students will also engage in film studies, literature and a comprehensive review of grammar, all of which will prepare them for continued language study at the university level. Teacher-student and/or student-student interactions are conducted exclusively in Spanish.",
        "College Prep",
        81,
        [
            offering("SPA511", "SEMESTER 1", "College Prep", grades=[10, 11, 12], prereqs=["Spanish 3-4, Spanish 4 or AP Spanish Language and Culture"]),
            offering("SPA512", "SEMESTER 2", "College Prep", grades=[10, 11, 12], prereqs=["Spanish 3-4, Spanish 4 or AP Spanish Language and Culture"]),
        ],
    ),
]

# Page 82 ELD intro and ELD 1, 2
page_82 = page_json(
    courses=[
        course(
            "English Language Development (ELD) 1",
            "English Language Development",
            "This is a two-credit course for students in the ELD program at the beginning level who are new to the English language or have emerging English vocabulary and communication skills. The course meets two periods each day. Students work on developing and expanding their vocabulary, grammar, speaking, listening, reading and writing skills. Students will practice their writing skills in the context of the course readings and will start with basic sentence structures and end with essay writing. Speaking and listening will focus on proper pronunciation as well as interpersonal and presentational communication.",
            "College Prep",
            82,
            [
                offering("ELD161", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["WIDA-screener/ACCESS exam COMPOSITE 1.0-1.9"]),
                offering("ELD162", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["WIDA-screener/ACCESS exam COMPOSITE 1.0-1.9"]),
            ],
            notes=["This is a two-credit course. The course meets two periods each day."],
        ),
        course(
            "English Language Development (ELD) 2",
            "English Language Development",
            "This is a two-credit course for students in the ELD program at the intermediate level. This course will meet two periods each day and instruction is entirely in English. Students will build on all four language domains (listening, speaking, reading and writing) across thematic units. Their writing skills move beyond paragraph construction to composing, revising and editing essays within various writing genres. Speaking and listening is practiced and assessed as students are expected to have conversational and presentational English speaking skills.",
            "College Prep",
            82,
            [
                offering("ELD261", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["Proficiency as demonstrated on WIDA-screener/ACCESS exam COMPOSITE 2.0-2.9 or successful completion of ELD 1, teacher recommendation or director approval"]),
                offering("ELD262", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["Proficiency as demonstrated on WIDA-screener/ACCESS exam COMPOSITE 2.0-2.9 or successful completion of ELD 1, teacher recommendation or director approval"]),
            ],
            notes=["This is a two-credit course. This course will meet two periods each day."],
        ),
    ],
    warnings=[
        "English Language Development (ELD) program overview page. The Stevenson High School English Language Development (ELD) Program is part of the Multilingual Learning Division and is designed to support students at Stevenson who are identified as multilingual learners. The goals of this program are to strengthen students’ literacy and oracy skills in English and to empower students to become multilingual and multiliterate by sustaining students’ academic engagement with their home languages. Appropriate placement of students in the ELD program is done through state and national testing scores, home language surveys, teacher recommendations and the cooperative efforts of the Student Services Department and the ELD faculty in the Multilingual Learning Division."
    ],
)

# Page 83 ELD 3 Language, ELD 3 Literature, ELD 4, Current Events
courses_83 = [
    course(
        "English Language Development (ELD) 3: Language",
        "English Language Development",
        "This is one of two courses available for students in the ELD program at the advanced level. This course may be taken concurrently with English Language Development (ELD) 3 Literature (ELD371/372) or may be taken alone. Students will leverage their own cultural and linguistic assets as they work to expand their English language proficiency. In addition to a focus on the development of advanced literacy skills, including argumentative writing and literary analysis, students will foster their listening and speaking skills by participating in discussions, debates and oral presentations.",
        "College Prep",
        83,
        [
            offering("ELD361", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["Proficiency as demonstrated on WIDA-screener/ACCESS exam COMPOSITE 3.0-3.9 or successful completion of ELD 2, teacher recommendation or director approval"]),
            offering("ELD362", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["Proficiency as demonstrated on WIDA-screener/ACCESS exam COMPOSITE 3.0-3.9 or successful completion of ELD 2, teacher recommendation or director approval"]),
        ],
        notes=["May be taken concurrently with English Language Development (ELD) 3 Literature."],
    ),
    course(
        "English Language Development (ELD) 3: Literature",
        "English Language Development",
        "This is one of two courses available for students in the ELD program at the advanced level. This course may be taken concurrently with English Language Development (ELD) 3 Language (ELD361/362) or may be taken alone. Students will leverage their own cultural and linguistic assets as they work to expand their English language proficiency. Students will explore both fiction and nonfiction literature through both common and independent reading tasks. Students will make text-to-self connections as they engage in literary analysis and argumentative writing, including multi-page process writing.",
        "College Prep",
        83,
        [
            offering("ELD371", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["Proficiency as demonstrated on WIDA-screener/ACCESS exam COMPOSITE 3.0-3.9 or successful completion of ELD 2, teacher recommendation or director approval"]),
            offering("ELD372", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["Proficiency as demonstrated on WIDA-screener/ACCESS exam COMPOSITE 3.0-3.9 or successful completion of ELD 2, teacher recommendation or director approval"]),
        ],
        notes=["May be taken concurrently with English Language Development (ELD) 3 Language."],
    ),
    course(
        "English Language Development (ELD) 4",
        "English Language Development",
        "This is an English course for students who are transitioning out of the ELD program. Students are expected to produce work with ELD support similar to that of a student in a Communication Arts English course. Students’ proficiencies will advance in the areas of literary analysis, writing, grammar, oral communication and research. Students will explore literary works from their own cultural backgrounds and experiences and use literature as a pathway to greater understanding of diverse perspectives and narratives.",
        "College Prep",
        83,
        [
            offering("ELD461", "SEMESTER 1", "College Prep", grades=[9, 10, 11, 12], prereqs=["Proficiency as demonstrated on WIDA-screener/ACCESS exam COMPOSITE 4.0-4.8 or successful completion of ELD 3: Language and/or ELD 3: Literature, teacher recommendation or director approval"]),
            offering("ELD462", "SEMESTER 2", "College Prep", grades=[9, 10, 11, 12], prereqs=["Proficiency as demonstrated on WIDA-screener/ACCESS exam COMPOSITE 4.0-4.8 or successful completion of ELD 3: Language and/or ELD 3: Literature, teacher recommendation or director approval"]),
        ],
    ),
    course(
        "Current Events",
        "English Language Development",
        "This one-semester elective course is designed to develop students’ academic, social and instructional language across the five WIDA Standards (Social and Instructional Language, the Language of Language Arts, the Language of Mathematics, the Language of Science and the Language of Social Studies) through discussion and guided written reflection around current events and students’ own experiences. Special focus will not only be given to written, audio and visual sources that are connected with the WIDA Standards, but also to students’ own cultural and linguistic experiences across these standards. Additionally, added focus will be given to academic, social and instructional language for WIDA’s five complementary strands (the Language of Music and Performing Arts, the Language of Humanities, the Language of Visual Arts, the Language of Health and Physical Education and the Language of Technology and Engineering.) This course may be repeated for credit.",
        "College Prep",
        83,
        [
            offering("ELD561", "SEMESTER 1", "College Prep", duration="one semester", grades=[9, 10, 11, 12], prereqs=["None"]),
            offering("ELD562", "SEMESTER 2", "College Prep", duration="one semester", grades=[9, 10, 11, 12], prereqs=["None"]),
        ],
        notes=["This course may be repeated for credit."],
    ),
]
page_83 = page_json(courses=courses_83)

pages = {
    71: page_71,
    72: page_72,
    73: page_73,
    74: page_json(courses=courses_74),
    75: page_json(courses=courses_75),
    76: page_json(courses=courses_76),
    77: page_json(courses=courses_77),
    78: page_json(courses=courses_78),
    79: page_json(courses=courses_79),
    80: page_json(courses=courses_80),
    81: page_json(courses=courses_81),
    82: page_82,
    83: page_83,
}


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def main():
    for n, data in pages.items():
        write_json(PAGE_DIR / f"page_{n:03d}.json", data)

    # Combine into section
    section = {"departments": [], "courses": [], "graduationRequirements": [], "warnings": []}
    for n in sorted(pages):
        data = pages[n]
        section["departments"].extend(data.get("departments", []))
        section["courses"].extend(data.get("courses", []))
        section["graduationRequirements"].extend(data.get("graduationRequirements", []))
        section["warnings"].extend(data.get("warnings", []))

    write_json(SECTION_DIR / "language_learning.json", section)
    print(f"Wrote {len(section['courses'])} courses and {len(section['warnings'])} warnings to {SECTION_DIR / 'language_learning.json'}")


if __name__ == "__main__":
    main()
