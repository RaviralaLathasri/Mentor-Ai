"""Career roadmap generation service."""

from __future__ import annotations

from datetime import datetime
from math import ceil
import re
from typing import Dict, List, Tuple

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import CareerRoadmap
from app.schemas import CareerLevelEnum


class CareerRoadmapService:
    _ROLE_ALIASES = {
        "analyst": "data analyst",
        "data analytics": "data analyst",
        "data science": "data scientist",
        "ml engineer": "ai engineer",
        "machine learning engineer": "ai engineer",
        "backend engineer": "backend developer",
        "back end developer": "backend developer",
    }

    _ROLE_TEMPLATES: Dict[str, Dict] = {
        "data analyst": {
            "display_name": "Data Analyst",
            "skills": [
                "Excel",
                "SQL",
                "Statistics",
                "Python",
                "Pandas",
                "Data visualization",
                "Power BI or Tableau",
            ],
            "tools": ["Excel", "SQL", "Python", "Power BI", "Tableau", "Jupyter Notebook"],
            "courses": [
                {
                    "title": "Google Data Analytics Professional Certificate",
                    "platform": "Coursera",
                    "link": "https://www.coursera.org/professional-certificates/google-data-analytics",
                    "description": "Structured analyst pathway.",
                },
                {
                    "title": "Data Analyst with Python Track",
                    "platform": "DataCamp",
                    "link": "https://www.datacamp.com/tracks/data-analyst-with-python",
                    "description": "Hands-on SQL and Python practice.",
                },
                {
                    "title": "Data Analysis with Python",
                    "platform": "freeCodeCamp",
                    "link": "https://www.freecodecamp.org/learn/data-analysis-with-python/",
                    "description": "Free project-based curriculum.",
                },
                {
                    "title": "Kaggle Learn",
                    "platform": "Kaggle",
                    "link": "https://www.kaggle.com/learn",
                    "description": "Micro-courses for data analysis skills.",
                },
                {
                    "title": "Data Analytics Courses",
                    "platform": "Udemy",
                    "link": "https://www.udemy.com/courses/search/?q=data%20analytics",
                    "description": "Optional guided projects and interview prep.",
                },
            ],
            "youtube_resources": [
                {
                    "title": "Analyst Career and SQL Practice",
                    "platform": "YouTube",
                    "link": "https://www.youtube.com/@AlexTheAnalyst",
                    "description": "Roadmap and portfolio-focused tutorials.",
                }
            ],
            "documentation": [
                {
                    "title": "Pandas Documentation",
                    "platform": "Docs",
                    "link": "https://pandas.pydata.org/docs/",
                    "description": "Reference for data wrangling tasks.",
                },
                {
                    "title": "Power BI Documentation",
                    "platform": "Docs",
                    "link": "https://learn.microsoft.com/power-bi/",
                    "description": "Dashboard and reporting workflows.",
                },
            ],
            "certifications": [
                "Google Data Analytics Professional Certificate",
                "IBM Data Analyst Professional Certificate",
                "Microsoft Power BI Data Analyst Associate",
            ],
            "projects": {
                "beginner": ["Sales data dashboard"],
                "intermediate": ["Customer churn analysis with SQL + Python"],
                "advanced": ["End-to-end analytics pipeline with BI dashboard"],
            },
            "interview_topics": [
                "SQL joins and window functions",
                "Metric definition and KPI design",
                "Data cleaning strategy",
                "Dashboard storytelling",
            ],
            "practice_platforms": ["Kaggle", "LeetCode SQL", "Interview Query"],
            "sample_questions": [
                "How would you define a retention metric?",
                "Explain INNER JOIN vs LEFT JOIN with a practical example.",
            ],
            "portfolio_tips": [
                "Show business question, data cleaning, analysis, and final recommendation.",
                "Publish dashboards and SQL queries with README files.",
            ],
            "career_advice": [
                "Apply once you have 3 solid projects with measurable outcomes.",
                "Tailor resume bullets to impact, not only tools.",
            ],
        },
        "data scientist": {
            "display_name": "Data Scientist",
            "skills": [
                "Python",
                "Statistics",
                "Machine learning",
                "Feature engineering",
                "Model evaluation",
                "Experimentation",
                "Model interpretation",
            ],
            "tools": ["Python", "Pandas", "NumPy", "scikit-learn", "Jupyter", "SQL"],
            "courses": [
                {
                    "title": "IBM Data Science Professional Certificate",
                    "platform": "Coursera",
                    "link": "https://www.coursera.org/professional-certificates/ibm-data-science",
                    "description": "Broad data science learning path.",
                },
                {
                    "title": "Machine Learning Scientist with Python",
                    "platform": "DataCamp",
                    "link": "https://www.datacamp.com/tracks/machine-learning-scientist-with-python",
                    "description": "Applied modeling track.",
                },
                {
                    "title": "Machine Learning with Python",
                    "platform": "freeCodeCamp",
                    "link": "https://www.freecodecamp.org/learn/machine-learning-with-python/",
                    "description": "Free ML fundamentals and exercises.",
                },
                {
                    "title": "Kaggle Competitions",
                    "platform": "Kaggle",
                    "link": "https://www.kaggle.com/competitions",
                    "description": "Practice model evaluation with real data.",
                },
                {
                    "title": "Data Science Courses",
                    "platform": "Udemy",
                    "link": "https://www.udemy.com/courses/search/?q=data%20science",
                    "description": "Extra project-focused material.",
                },
            ],
            "youtube_resources": [
                {
                    "title": "Data Science Tutorials",
                    "platform": "YouTube",
                    "link": "https://www.youtube.com/@statquest",
                    "description": "Strong intuition for ML/statistics fundamentals.",
                }
            ],
            "documentation": [
                {
                    "title": "scikit-learn User Guide",
                    "platform": "Docs",
                    "link": "https://scikit-learn.org/stable/user_guide.html",
                    "description": "Modeling and validation best practices.",
                }
            ],
            "certifications": [
                "IBM Data Science Professional Certificate",
                "TensorFlow Developer Certificate",
            ],
            "projects": {
                "beginner": ["EDA and predictive modeling on a public dataset"],
                "intermediate": ["Churn prediction with explainability"],
                "advanced": ["Production-style ML workflow with monitoring notes"],
            },
            "interview_topics": [
                "Bias-variance tradeoff",
                "Cross-validation",
                "Precision/recall tradeoffs",
                "Feature importance interpretation",
            ],
            "practice_platforms": ["Kaggle", "LeetCode", "Interview Query"],
            "sample_questions": [
                "How do you select the right evaluation metric for a business problem?",
                "How would you debug model drift in production?",
            ],
            "portfolio_tips": [
                "Include both technical depth and business interpretation.",
                "Keep repositories reproducible with environment instructions.",
            ],
            "career_advice": [
                "Prioritize impact-driven projects over algorithm complexity.",
                "Practice both coding and case-style interview communication.",
            ],
        },
        "ai engineer": {
            "display_name": "AI Engineer",
            "skills": [
                "Python",
                "ML fundamentals",
                "Deep learning basics",
                "Prompt engineering",
                "LLM application development",
                "MLOps and deployment",
            ],
            "tools": ["Python", "PyTorch/TensorFlow", "Hugging Face", "FastAPI", "Docker", "MLflow"],
            "courses": [
                {
                    "title": "Machine Learning Specialization",
                    "platform": "Coursera",
                    "link": "https://www.coursera.org/specializations/machine-learning-introduction",
                    "description": "Strong ML core for AI systems.",
                },
                {
                    "title": "AI Engineer for Developers",
                    "platform": "DataCamp",
                    "link": "https://www.datacamp.com/career-tracks/ai-engineer-for-developers",
                    "description": "Hands-on AI engineering projects.",
                },
                {
                    "title": "Machine Learning with Python",
                    "platform": "freeCodeCamp",
                    "link": "https://www.freecodecamp.org/learn/machine-learning-with-python/",
                    "description": "Free practical ML curriculum.",
                },
                {
                    "title": "Kaggle Learn",
                    "platform": "Kaggle",
                    "link": "https://www.kaggle.com/learn",
                    "description": "Short practical model-building modules.",
                },
                {
                    "title": "AI Engineering Courses",
                    "platform": "Udemy",
                    "link": "https://www.udemy.com/courses/search/?q=ai%20engineering",
                    "description": "Project and deployment-focused courses.",
                },
            ],
            "youtube_resources": [
                {
                    "title": "GenAI and LLM Tutorials",
                    "platform": "YouTube",
                    "link": "https://www.youtube.com/@Deeplearningai",
                    "description": "Applied AI and LLM workflows.",
                }
            ],
            "documentation": [
                {
                    "title": "Hugging Face Docs",
                    "platform": "Docs",
                    "link": "https://huggingface.co/docs",
                    "description": "Model usage and deployment references.",
                }
            ],
            "certifications": [
                "TensorFlow Developer Certificate",
                "AWS Certified Machine Learning - Specialty",
            ],
            "projects": {
                "beginner": ["LLM prompt-based assistant for FAQs"],
                "intermediate": ["RAG chatbot with custom document retrieval"],
                "advanced": ["Production AI microservice with monitoring and feedback loop"],
            },
            "interview_topics": [
                "RAG architecture",
                "Prompt evaluation",
                "Latency and cost optimization",
                "Model monitoring strategy",
            ],
            "practice_platforms": ["Kaggle", "Hugging Face", "LeetCode"],
            "sample_questions": [
                "How would you design a reliable RAG system?",
                "How do you evaluate LLM quality in production?",
            ],
            "portfolio_tips": [
                "Show deployed AI apps, not just notebooks.",
                "Document architecture decisions and tradeoffs clearly.",
            ],
            "career_advice": [
                "Demonstrate system-level thinking: quality, cost, and reliability.",
                "Show ownership with end-to-end deployable projects.",
            ],
        },
        "backend developer": {
            "display_name": "Backend Developer",
            "skills": [
                "API design",
                "Databases and SQL",
                "Authentication and authorization",
                "Caching",
                "Testing",
                "System design",
                "CI/CD fundamentals",
            ],
            "tools": ["FastAPI/Express", "PostgreSQL", "Redis", "Docker", "GitHub Actions", "Postman"],
            "courses": [
                {
                    "title": "Meta Back-End Developer Professional Certificate",
                    "platform": "Coursera",
                    "link": "https://www.coursera.org/professional-certificates/meta-back-end-developer",
                    "description": "Structured backend track with projects.",
                },
                {
                    "title": "Backend Development Courses",
                    "platform": "Udemy",
                    "link": "https://www.udemy.com/courses/search/?q=backend%20development",
                    "description": "Extra API and deployment practice.",
                },
                {
                    "title": "Back End Development and APIs",
                    "platform": "freeCodeCamp",
                    "link": "https://www.freecodecamp.org/learn/back-end-development-and-apis/",
                    "description": "Free backend fundamentals with projects.",
                },
                {
                    "title": "Kaggle Learn (Python/SQL)",
                    "platform": "Kaggle",
                    "link": "https://www.kaggle.com/learn",
                    "description": "Data-heavy backend practice with SQL/Python.",
                },
                {
                    "title": "Developer Career Tracks",
                    "platform": "DataCamp",
                    "link": "https://www.datacamp.com/career-tracks",
                    "description": "Optional language and data tracks.",
                },
            ],
            "youtube_resources": [
                {
                    "title": "Backend and System Design Tutorials",
                    "platform": "YouTube",
                    "link": "https://www.youtube.com/@hnasr",
                    "description": "Backend architecture and systems content.",
                }
            ],
            "documentation": [
                {
                    "title": "FastAPI Documentation",
                    "platform": "Docs",
                    "link": "https://fastapi.tiangolo.com/",
                    "description": "API framework and deployment references.",
                }
            ],
            "certifications": [
                "Meta Back-End Developer Professional Certificate",
                "AWS Certified Developer - Associate",
            ],
            "projects": {
                "beginner": ["Task management REST API with auth"],
                "intermediate": ["E-commerce backend with caching and tests"],
                "advanced": ["Scalable microservice backend with CI/CD and observability"],
            },
            "interview_topics": [
                "Database indexing",
                "API versioning",
                "Caching strategies",
                "Concurrency and scaling",
            ],
            "practice_platforms": ["LeetCode", "HackerRank", "Pramp"],
            "sample_questions": [
                "How would you design a URL shortener?",
                "How would you prevent N+1 query issues?",
            ],
            "portfolio_tips": [
                "Show clean architecture, tests, and deployment docs in each API project.",
                "Add tradeoff notes and design diagrams.",
            ],
            "career_advice": [
                "Communicate reliability and maintainability decisions in interviews.",
                "Contribute to open-source backend issues for real-world experience.",
            ],
        },
    }

    def __init__(self, db: Session):
        self.db = db

    @classmethod
    def _normalize_role(cls, role: str) -> str:
        key = " ".join((role or "").strip().lower().split())
        return cls._ROLE_ALIASES.get(key, key)

    @staticmethod
    def _normalize_level(level: CareerLevelEnum | str) -> CareerLevelEnum:
        if isinstance(level, CareerLevelEnum):
            return level
        mapping = {
            "beginner": CareerLevelEnum.BEGINNER,
            "intermediate": CareerLevelEnum.INTERMEDIATE,
            "advanced": CareerLevelEnum.ADVANCED,
        }
        raw = str(level or "").strip().lower()
        if raw not in mapping:
            raise ValueError("Level must be Beginner, Intermediate, or Advanced")
        return mapping[raw]

    @staticmethod
    def _parse_duration(duration: str) -> Tuple[int, str, int]:
        text = " ".join((duration or "").strip().lower().split())
        match = re.match(r"^(\d+)\s*(week|weeks|month|months)$", text)
        if not match:
            raise ValueError("Duration must be like '12 weeks' or '6 months'")
        amount = int(match.group(1))
        unit = "weeks" if match.group(2).startswith("week") else "months"
        total_weeks = amount if unit == "weeks" else amount * 4
        return amount, unit, total_weeks

    @staticmethod
    def _split_evenly(total: int, parts: int) -> List[int]:
        base = total // parts
        remainder = total % parts
        return [base + (1 if idx < remainder else 0) for idx in range(parts)]

    @staticmethod
    def _phase_theme(phase_idx: int, phase_count: int) -> str:
        if phase_count == 1:
            return "Foundation and execution"
        if phase_idx == 0:
            return "Foundation"
        if phase_idx == phase_count - 1:
            return "Interview and job readiness"
        if phase_idx == 1:
            return "Core skill building"
        return "Project and optimization"

    @staticmethod
    def _project_stage_suffix(phase_idx: int) -> str:
        stages = [
            "scope and dataset setup",
            "core implementation",
            "evaluation and iteration",
            "deployment/reporting polish",
            "portfolio packaging",
        ]
        return stages[min(phase_idx, len(stages) - 1)]

    def _resolve_template(self, role: str) -> Dict:
        normalized = self._normalize_role(role)
        return self._ROLE_TEMPLATES.get(
            normalized,
            {
                "display_name": " ".join(word.capitalize() for word in normalized.split()) or "Career Role",
                "skills": ["Core fundamentals", "Project execution", "Communication"],
                "tools": ["Git", "VS Code"],
                "courses": [],
                "youtube_resources": [],
                "documentation": [],
                "certifications": [],
                "projects": {
                    "beginner": ["Beginner project"],
                    "intermediate": ["Intermediate project"],
                    "advanced": ["Advanced project"],
                },
                "interview_topics": ["Core fundamentals", "Problem solving"],
                "practice_platforms": ["Kaggle", "LeetCode"],
                "sample_questions": [f"How would you solve a typical {role} task end-to-end?"],
                "portfolio_tips": ["Publish practical projects with clear READMEs."],
                "career_advice": ["Focus on consistent project output every week."],
            },
        )

    def _build_timeline(
        self,
        template: Dict,
        duration_amount: int,
        duration_unit: str,
        total_weeks: int,
        level: CareerLevelEnum,
    ) -> List[Dict]:
        if total_weeks <= 6:
            phase_count = 2
        elif total_weeks <= 12:
            phase_count = 3
        elif total_weeks <= 24:
            phase_count = 4
        else:
            phase_count = 5

        # Keep phase count aligned to selected duration to avoid invalid extra phases
        # (e.g., "2 months" should never generate "Month 3").
        if duration_unit == "months":
            phase_count = max(1, min(phase_count, duration_amount))
        else:
            phase_count = max(1, min(phase_count, total_weeks))

        skills = template["skills"]
        tools = template["tools"]
        project_bank = template["projects"].get(level.value.lower(), [])
        skills_per_phase = max(1, ceil(len(skills) / phase_count))
        tools_per_phase = max(1, ceil(len(tools) / phase_count))

        unit_chunks = self._split_evenly(duration_amount, phase_count)
        week_chunks = self._split_evenly(total_weeks, phase_count)

        timeline: List[Dict] = []
        current_unit = 1
        current_week = 1
        for phase_idx in range(phase_count):
            skill_slice = skills[phase_idx * skills_per_phase : (phase_idx + 1) * skills_per_phase] or skills[-2:]
            tool_slice = tools[phase_idx * tools_per_phase : (phase_idx + 1) * tools_per_phase] or tools[-1:]
            if project_bank:
                if len(project_bank) == 1 and phase_count > 1:
                    phase_project = f"{project_bank[0]} ({self._project_stage_suffix(phase_idx)})"
                else:
                    phase_project = project_bank[phase_idx % len(project_bank)]
            else:
                phase_project = f"Portfolio mini-project ({self._project_stage_suffix(phase_idx)})"

            if duration_unit == "months":
                chunk = max(1, unit_chunks[phase_idx])
                end = current_unit + chunk - 1
                title = f"Month {current_unit}" if chunk == 1 else f"Month {current_unit}-{end}"
                duration_label = f"{chunk} month" if chunk == 1 else f"{chunk} months"
                current_unit = end + 1
            else:
                chunk = max(1, week_chunks[phase_idx])
                end = current_week + chunk - 1
                title = f"Week {current_week}" if chunk == 1 else f"Week {current_week}-{end}"
                duration_label = f"{chunk} week" if chunk == 1 else f"{chunk} weeks"

            intensity = {
                CareerLevelEnum.BEGINNER: "Focus on fundamentals and repetition.",
                CareerLevelEnum.INTERMEDIATE: "Focus on depth, performance, and tradeoffs.",
                CareerLevelEnum.ADVANCED: "Focus on architecture, scale, and interview-quality execution.",
            }[level]

            theme = self._phase_theme(phase_idx, phase_count)

            timeline.append(
                {
                    "phase_title": title,
                    "duration_label": duration_label,
                    "learning_goals": [
                        f"Phase theme: {theme}.",
                        f"Master skills: {', '.join(skill_slice)}.",
                        f"Practice tools: {', '.join(tool_slice)}.",
                        f"Build project: {phase_project}.",
                        intensity,
                    ],
                    "milestones": [
                        f"Complete {max(8, week_chunks[phase_idx] * 3)} focused study sessions.",
                        "Publish progress updates and code artifacts.",
                        (
                            "Finalize interview notes and portfolio case-study draft."
                            if phase_idx == phase_count - 1
                            else "Capture one measurable outcome from this phase."
                        ),
                    ],
                }
            )
            current_week += max(1, week_chunks[phase_idx])

        return timeline

    def _store_latest(self, role: str, level: CareerLevelEnum, duration: str, roadmap: Dict) -> None:
        role_key = self._normalize_role(role)
        row = (
            self.db.query(CareerRoadmap)
            .filter(CareerRoadmap.role == role_key)
            .order_by(desc(CareerRoadmap.updated_at))
            .first()
        )
        if row:
            row.level = level.value
            row.duration = duration
            row.roadmap_json = roadmap
            row.updated_at = datetime.utcnow()
        else:
            row = CareerRoadmap(
                role=role_key,
                level=level.value,
                duration=duration,
                roadmap_json=roadmap,
            )
            self.db.add(row)
        self.db.commit()

    def generate_roadmap(self, role: str, duration: str, level: CareerLevelEnum | str, save: bool = True) -> Dict:
        level_enum = self._normalize_level(level)
        duration_amount, duration_unit, total_weeks = self._parse_duration(duration)
        template = self._resolve_template(role)

        roadmap = {
            "role": template["display_name"],
            "level": level_enum.value,
            "duration": f"{duration_amount} {duration_unit}",
            "timeline": self._build_timeline(
                template=template,
                duration_amount=duration_amount,
                duration_unit=duration_unit,
                total_weeks=total_weeks,
                level=level_enum,
            ),
            "skills_to_master": template["skills"],
            "tools": template["tools"],
            "courses": template["courses"],
            "youtube_resources": template["youtube_resources"],
            "documentation": template["documentation"],
            "projects": template["projects"],
            "certifications": template["certifications"],
            "interview_preparation": {
                "important_topics": template["interview_topics"],
                "practice_platforms": template["practice_platforms"],
                "sample_questions": template["sample_questions"],
            },
            "portfolio_tips": template["portfolio_tips"],
            "career_advice": template["career_advice"],
        }

        if save:
            self._store_latest(role=role, level=level_enum, duration=roadmap["duration"], roadmap=roadmap)

        return roadmap

    def get_latest_roadmap(self, role: str) -> Dict | None:
        role_key = self._normalize_role(role)
        row = (
            self.db.query(CareerRoadmap)
            .filter(CareerRoadmap.role == role_key)
            .order_by(desc(CareerRoadmap.updated_at))
            .first()
        )
        if not row or not isinstance(row.roadmap_json, dict):
            return None
        return row.roadmap_json
