"""
resume_insights.py
------------------
Lightweight, deterministic resume scoring + keyword gap analysis helpers.

These functions are intentionally rule-based (no LLM dependency) so they can run
fast, consistently, and safely in production.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence, Tuple


AI_DATA_KEYWORDS: List[str] = [
    "Python",
    "Machine Learning",
    "Deep Learning",
    "TensorFlow",
    "PyTorch",
    "Data Analysis",
    "Pandas",
    "NumPy",
    "SQL",
    "Statistics",
    "Data Visualization",
    "Scikit-learn",
    "NLP",
    "Computer Vision",
    "FastAPI",
    "Docker",
    "Git",
]


_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_US_PHONE_RE = re.compile(r"\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b")

_URL_RE = re.compile(r"\b(?:https?://|www\.)[^\s<>()]+\b", re.IGNORECASE)

# Keep this conservative: score should not fire on random links to companies/certs.
_PORTFOLIO_HINT_RE = re.compile(
    r"\b(github\.com|gitlab\.com|bitbucket\.org|github\.io|kaggle\.com|leetcode\.com|linktr\.ee|behance\.net|dribbble\.com|vercel\.app|netlify\.app)\b",
    re.IGNORECASE,
)

_ACTION_VERBS = {
    "built",
    "developed",
    "improved",
    "optimized",
    "designed",
    "implemented",
    "delivered",
    "led",
    "created",
    "reduced",
    "increased",
    "automated",
    "deployed",
    "analyzed",
    "achieved",
}


def _normalize_for_search(text: str) -> str:
    """Lowercase and convert non-alphanumerics to spaces for stable matching."""
    normalized = re.sub(r"[^a-z0-9]+", " ", (text or "").lower())
    return re.sub(r"\s+", " ", normalized).strip()


def _has_bullets(text: str) -> bool:
    return any(_is_bullet(line) for line in (text or "").splitlines())


def _count_bullets(text: str) -> int:
    return sum(1 for line in (text or "").splitlines() if _is_bullet(line))


def _has_quantified_bullets(text: str) -> bool:
    for line in (text or "").splitlines():
        if _is_bullet(line) and re.search(r"\d", line):
            return True
    return False


def _bullets_need_action_verbs(text: str) -> bool:
    bullets = [line.strip() for line in (text or "").splitlines() if _is_bullet(line)]
    if not bullets:
        return False
    weak = 0
    for bullet in bullets:
        normalized = _normalize_for_search(bullet)
        if not any(f" {verb} " in f" {normalized} " for verb in _ACTION_VERBS):
            weak += 1
    return weak / max(1, len(bullets)) >= 0.5


def _is_bullet(line: str) -> bool:
    stripped = (line or "").strip()
    # Support common bullets and the mojibake variant seen in some PDF extractions.
    return bool(re.match("^(\\-|\\*|\u2022|\u00e2\u20ac\u00a2|\\d+\\.)\\s+", stripped))


def has_contact_info(resume_text: str) -> bool:
    text = resume_text or ""
    if _EMAIL_RE.search(text):
        return True
    if _US_PHONE_RE.search(text):
        return True
    # LinkedIn often acts as contact info even if phone is omitted.
    if re.search(r"\blinkedin\.com/\S+", text, flags=re.IGNORECASE):
        return True
    return False


def has_github_or_portfolio_link(resume_text: str) -> bool:
    text = resume_text or ""
    # Prefer explicit signals: GitHub/GitLab/etc, or a resume section that includes a URL.
    if _PORTFOLIO_HINT_RE.search(text):
        return True
    urls = _URL_RE.findall(text)
    if not urls:
        return False
    # If they wrote "portfolio" next to a URL, treat as a portfolio.
    if re.search(r"\bportfolio\b", text, flags=re.IGNORECASE):
        return True
    # Fallback: any URL that isn't obviously an email and isn't LinkedIn (counted separately).
    for url in urls:
        if "linkedin.com" in url.lower():
            continue
        return True
    return False


def keyword_gap_analysis(
    resume_text: str,
    important_keywords: Sequence[str] = AI_DATA_KEYWORDS,
) -> Tuple[List[str], List[str]]:
    """
    Returns (detected_keywords, missing_keywords) for the provided important list.

    Matching is case-insensitive and punctuation-robust.
    """
    normalized_text = _normalize_for_search(resume_text)

    # Canonical keyword -> acceptable variants (normalized phrases).
    variants: Dict[str, List[str]] = {
        "Scikit-learn": ["scikit learn", "scikit-learn", "sklearn"],
        "PyTorch": ["pytorch", "torch"],
        "TensorFlow": ["tensorflow"],
        "FastAPI": ["fastapi", "fast api"],
        "Data Visualization": ["data visualization", "data visualisation"],
        "NLP": ["nlp", "natural language processing"],
        "Computer Vision": ["computer vision"],
        "SQL": ["sql", "postgresql", "postgres", "mysql", "sqlite"],
        "Git": ["git", "github", "gitlab", "bitbucket"],
    }

    detected: List[str] = []
    missing: List[str] = []

    for keyword in important_keywords:
        keyword_variants = variants.get(keyword, [keyword])
        present = False
        for variant in keyword_variants:
            variant_norm = _normalize_for_search(variant)
            if not variant_norm:
                continue
            pattern = rf"(?:^| ){re.escape(variant_norm)}(?: |$)"
            if re.search(pattern, normalized_text):
                present = True
                break
        (detected if present else missing).append(keyword)

    return detected, missing


def _keyword_points(detected: Sequence[str], important: Sequence[str]) -> int:
    del important
    return 20 if detected else 0


def _formatting_points(sections: Dict[str, str]) -> int:
    """
    10 points if Experience/Projects include bullet points (basic ATS-friendly formatting heuristic).
    """
    experience = sections.get("experience", "")
    projects = sections.get("projects", "")
    bullet_count = _count_bullets(experience) + _count_bullets(projects)
    return 10 if bullet_count > 0 else 0


@dataclass(frozen=True)
class ResumeScoreBreakdown:
    total: int
    skills: int
    projects: int
    certifications: int
    education: int
    contact_info: int
    github_or_portfolio: int
    ats_keywords: int
    formatting: int


def calculate_resume_score(
    *,
    resume_text: str,
    sections: Dict[str, str],
    detected_keywords: Sequence[str],
    important_keywords: Sequence[str] = AI_DATA_KEYWORDS,
) -> ResumeScoreBreakdown:
    """
    Calculate a 0-100 resume score using the requested factor weights.

    Each factor is a boolean check; the returned total is the sum of all awarded points.
    """
    skills = 15 if sections.get("skills") else 0
    projects = 20 if sections.get("projects") else 0
    certifications = 10 if sections.get("certifications") else 0
    education = 10 if sections.get("education") else 0

    contact_info = 5 if has_contact_info(resume_text) else 0
    github_or_portfolio = 10 if has_github_or_portfolio_link(resume_text) else 0

    ats_keywords = max(0, min(20, _keyword_points(detected_keywords, important_keywords)))
    formatting = max(0, min(10, _formatting_points(sections)))

    total = skills + projects + certifications + education + contact_info + github_or_portfolio + ats_keywords + formatting
    total = max(0, min(100, int(total)))

    return ResumeScoreBreakdown(
        total=total,
        skills=skills,
        projects=projects,
        certifications=certifications,
        education=education,
        contact_info=contact_info,
        github_or_portfolio=github_or_portfolio,
        ats_keywords=ats_keywords,
        formatting=formatting,
    )


def improvement_suggestions(
    *,
    resume_text: str,
    sections: Dict[str, str],
    missing_sections: Sequence[str],
    missing_keywords: Sequence[str],
    score: ResumeScoreBreakdown,
) -> List[str]:
    suggestions: List[str] = []

    # Structure gaps
    if missing_sections:
        suggestions.append(f"Add missing sections: {', '.join(missing_sections)}.")

    # Contact + links
    if score.contact_info == 0:
        suggestions.append("Add clear contact information (email and phone, plus LinkedIn if available).")
    if score.github_or_portfolio == 0:
        suggestions.append("Add a GitHub and/or portfolio link so recruiters can verify projects and code quality.")

    # Keyword gaps
    if missing_keywords:
        top_missing = ", ".join(list(missing_keywords)[:6])
        suggestions.append(f"Include more ATS-friendly keywords that match the role (missing examples: {top_missing}).")

    # Project impact + bullets
    projects = sections.get("projects", "")
    experience = sections.get("experience", "")

    if projects and not _has_quantified_bullets(projects):
        suggestions.append("Add measurable results to project bullets (accuracy, latency, cost, users, time saved, % improvement).")
    if experience and not _has_quantified_bullets(experience):
        suggestions.append("Quantify experience impact wherever possible (metrics, scale, and outcomes).")

    if projects and _bullets_need_action_verbs(projects):
        suggestions.append("Start project bullets with strong action verbs (Built, Improved, Optimized, Automated, Deployed).")
    if experience and _bullets_need_action_verbs(experience):
        suggestions.append("Rewrite experience bullets to start with action verbs and end with impact.")

    if score.formatting == 0:
        suggestions.append("Improve formatting by using consistent bullet points in Experience/Projects and avoiding long paragraphs.")

    # Keep output clean and deterministic.
    deduped: List[str] = []
    seen = set()
    for item in suggestions:
        cleaned = " ".join((item or "").split()).strip()
        if not cleaned or cleaned in seen:
            continue
        deduped.append(cleaned)
        seen.add(cleaned)

    return deduped[:8]
