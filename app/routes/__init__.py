"""
app.routes
----------
Router modules for API endpoints.

All routers organized by feature:
- profiles: Student profile management
- wellness: Quiz and weakness tracking
- mentor_ai: AI mentor interactions
- feedback_loop: Feedback submission and adaptation
- adaptive: Adaptive learning control
- explain_mistakes: Misconception detection
- analytics: Learning analytics (read-only)
- resume: Resume upload mentoring
- career: Career roadmap generation
- interview: Mock interview generation/playback
- quiz: Quiz management (legacy)
- students: Student records (legacy)
- mentor: Mentor chat (legacy)
- feedback: Feedback (legacy)
"""

from . import profiles
from . import wellness
from . import mentor_ai
from . import feedback_loop
from . import adaptive
from . import explain_mistakes
from . import analytics
from . import resume
from . import career
from . import interview

__all__ = [
    "profiles",
    "wellness",
    "mentor_ai",
    "feedback_loop",
    "adaptive",
    "explain_mistakes",
    "analytics",
    "resume",
    "career",
    "interview",
]
