"""
ARCHITECTURE.md
===============
Complete Modular Backend Architecture for Human-in-the-Loop Adaptive Mentor AI

OVERVIEW
========
Refactored from monolithic endpoints to clean, testable, production-ready architecture
with clear separation of concerns across:
- Database Layer (Models)
- Schema Layer (Validation)
- Service Layer (Business Logic)
- Router Layer (API Endpoints)


DESIGN PRINCIPLES
=================

1. SEPARATION OF CONCERNS
   - Models: ORM definitions, database schema
   - Schemas: Pydantic validation, request/response contracts
   - Services: Business logic, algorithms, external integrations
   - Routers: HTTP endpoints, dependency injection, error handling

2. DEPENDENCY INJECTION
   - Database sessions injected via FastAPI Depends()
   - Services depend on DB and other services
   - No global state or singletons
   - Testable: easy to mock dependencies

3. SINGLE RESPONSIBILITY
   - Each service class handles ONE domain
   - Each router handles ONE feature area
   - Each model represents ONE database table
   - Each schema validates ONE data structure

4. MODULAR ROUTING
   - Independent feature routers
   - Organized by business feature, not CRUD
   - Share common prefixes for API consistency
   - Clear tag organization in Swagger docs

5. STATELESS SERVICES
   - Services compute and store, but hold no state
   - All state in database or request/response
   - Thread-safe and scalable


ARCHITECTURE DIAGRAM
====================

┌─────────────────────────────────────────────────────────────┐
│                       FASTAPI APP                           │
│                      (main.py)                              │
│  - CORS enabled                                             │
│  - All routers registered                                   │
│  - Database initialized on startup                          │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┬──────────────────┬────────────────┐
    │                 │                  │                │
    ▼                 ▼                  ▼                ▼
 PROFILES       WELLNESS            MENTOR_AI        FEEDBACK_LOOP
 ROUTER          ROUTER             ROUTER            ROUTER
    │                 │                  │                │
    │                 │                  │                │
    └────────┬────────┴──────────────────┴────────────────┘
             │
    ┌────────▼────────────────────────────────────────┐
    │          SERVICE LAYER (services.py)            │
    │                                                  │
    │ • StudentProfileService                         │
    │ • WeaknessAnalyzerService                       │
    │ • MentorAIService ← calls LLM                   │
    │ • FeedbackService                               │
    │ • AdaptiveLearningService ← orchestrates all    │
    └────────┬─────────────────────────────────────────┘
             │
    ┌────────▼────────────────────────────────────────┐
    │      DATABASE LAYER (database.py + ORM)         │
    │                                                  │
    │ Models:       Relationships:                    │
    │ • Student ────┬─→ StudentProfile (1:1)         │
    │               ├─→ WeaknessScore (1:N)           │
    │               ├─→ Feedback (1:N)                │
    │               ├─→ MentorResponse (1:N)          │
    │               └─→ AdaptiveSession (1:N)         │
    │ • Enums: DifficultyLevel, FeedbackType          │
    └────────┬─────────────────────────────────────────┘
             │
    ┌────────▼────────────────────────────────────────┐
    │           SQLITE DATABASE                       │
    │        (mentor_ai.db)                           │
    └──────────────────────────────────────────────────┘


ROUTER ORGANIZATION
===================

NEW MODULAR ROUTERS (Features + Services)
=========================================

1. /api/profile (profiles.py)
   └─ StudentProfileService
   Endpoints:
   - POST /create        → Create student + profile
   - POST /{id}/profile  → Create/update profile
   - GET /{id}          → Get profile
   - PUT /{id}          → Update profile

2. /api/analyze (wellness.py)
   └─ WeaknessAnalyzerService
   Endpoints:
   - POST /quiz         → Analyze quiz answer, update weakness
   - GET /weakest-concepts/{id} → Get top N weakest concepts

3. /api/mentor (mentor_ai.py)
   └─ MentorAIService
   Endpoints:
   - POST /respond      → Get adaptive mentor response

4. /api/feedback (feedback_loop.py)
   └─ FeedbackService
   Endpoints:
   - POST /submit       → Submit feedback, trigger adaptation
   - POST /rate-response → Quick rating submission

5. /api/adaptive (adaptive.py)
   └─ AdaptiveLearningService
   Endpoints:
   - POST /session      → Create learning session
   - GET /status/{id}   → Get adaptive learning status
   - GET /recommendations/{id} → Personalized recommendations

6. /api/explain (explain_mistakes.py)
   └─ WeaknessAnalyzerService
   Endpoints:
   - POST /mistake      → Explain wrong answer
   - POST /misconception-check → Quick misconception detection

LEGACY ROUTERS (Backward Compatibility)
========================================
- /api/students  (students.py)
- /api/quiz      (quiz.py)
- /api/mentor    (mentor.py) - Note: conflicts with new /api/mentor
- /api/feedback  (feedback.py) - Note: conflicts with new /api/feedback
- /api/analytics (analytics.py)


SERVICE LAYER DETAILS
====================

StudentProfileService
─────────────────────
Purpose: Manage student learning profiles
Dependency: DB Session

Methods:
- create_profile()           → Create new profile with validation
- get_profile()              → Retrieve profile by student_id
- update_profile()           → Safe field updates with validation
- get_learning_context()     → Extract context for LLM prompting

Key Validations:
- Confidence in [0.0, 1.0]
- One profile per student
- Student exists before profile creation


WeaknessAnalyzerService
───────────────────────
Purpose: Track concept mastery and learning weakness
Dependency: DB Session

Methods:
- get_or_create_weakness()   → Ensure weakness record exists
- analyze_quiz_result()      → Process answer, compute weakness delta
- get_weakest_concepts()     → Top N concepts by weakness score
- _detect_misconception()    → Identify false understanding
- _calculate_learning_priority() → Label priority (critical/high/medium/low)

Algorithm (update_from_quiz_result):
- Correct answer: weakness -= 0.1 (improvement)
- Wrong answer: weakness += 0.15 (regression)
- Clamped to [0.0, 1.0]

Priority Rules:
- weakness >= 0.75 → "critical"
- 0.5-0.75 → "high"
- 0.25-0.5 → "medium"
- < 0.25 → "low"


MentorAIService
───────────────
Purpose: Generate adaptive explanations and Socratic guidance
Dependency: DB Session, StudentProfileService, WeaknessAnalyzerService

Methods:
- generate_response()           → Main: analyze context + generate response
- _determine_explanation_style() → Select appropriate depth
- _infer_concept()              → Extract topic from query
- _generate_socratic_response()  → LLM call (placeholder)
- _generate_guiding_question()   → Follow-up question
- _store_response()              → Audit trail

Explanation Styles:
┌───────────────────────────────────────────────────────┐
│ Style         │ Condition                             │
├───────────────┼─────────────────────────────────────────┤
│ "simple"      │ high weakness (>0.6) OR low conf <0.3 │
│ "conceptual"  │ medium weakness (0.3-0.6) and conf    │
│ "deep"        │ low weakness (<0.3) and high conf >0.7│
└───────────────────────────────────────────────────────┘

Response Structure:
{
  "response_id": UUID,
  "response": "Socratic guidance...",
  "explanation_style": "conceptual",
  "target_concept": "algebra",
  "follow_up_question": "What if...?"
}


FeedbackService
───────────────
Purpose: Process human-in-the-loop feedback and adapt system
Dependency: DB Session, StudentProfileService

Methods:
- submit_feedback()         → Store feedback, trigger adaptation
- _adapt_to_feedback()      → Adjust difficulty/confidence

Feedback Types → Difficulty Adjustment:
"too_easy"   → Increase difficulty (EASY→MEDIUM→HARD)
"too_hard"   → Decrease difficulty (HARD→MEDIUM→EASY)
"helpful"    → No change (maintain current)
"unclear"    → No change (may adjust explanation in future)

Rating → Confidence Adjustment:
rating <= 2.0  → confidence -= 0.1 (dissatisfied)
rating >= 4.0  → confidence += 0.1 (satisfied)
Clamped to [0.0, 1.0]


AdaptiveLearningService
───────────────────────
Purpose: Orchestrate complete adaptive loop
Dependency: All other services

Methods:
- get_student_context_snapshot() → Aggregate all learning state
- _analyze_feedback_sentiment()   → Classify feedback mood

Context Snapshot:
{
  "confidence_level": 0.7,
  "primary_weakness_concepts": ["algebra", "geometry"],
  "strength_areas": ["arithmetic"],
  "preferred_difficulty": "medium",
  "recent_feedback_sentiment": "positive"
}

Sentiment Analysis:
positive  → More helpful feedback than negative
negative  → More negative (too_hard, unclear) than positive
neutral   → Balanced or no recent feedback


ERROR HANDLING
==============

All routers implement try-except:
- ValueError → 404 (not found, validation)
- HTTPException → Raised explicitly
- Generic Exception → 500 (server error)
- Terminal logging: [ERROR] endpoint_name: message | context

All services raise ValueError for:
- Missing records
- Invalid inputs
- Business rule violations


DEPENDENCY INJECTION FLOW
=========================

Example: Submit Feedback
1. Router: @router.post("/submit")
   - Depends(get_db) → FastAPI injects DB session
   
2. Router implementation:
   - service = FeedbackService(db)
   - service.submit_feedback() → returns (feedback_record, adaptation)
   
3. Service implementation:
   - Validates student exists
   - Stores feedback to database
   - Calls profile_service.get_profile(student_id)
   - Computes new difficulty
   - Commits changes
   
4. Database layer:
   - get_db() generator yields session
   - On_error, FastAPI auto-rollback
   - On_success, changes committed by service


DATA FLOW EXAMPLE: COMPLETE LEARNING LOOP
===========================================

1. Student Creates Profile
   POST /api/profile/create
   → ProfileService.create_profile()
   → Student + StudentProfile records created

2. Student Takes Quiz
   POST /api/analyze/quiz
   → WeaknessAnalyzerService.analyze_quiz_result()
   → WeaknessScore updated (+0.15 if wrong, -0.1 if right)
   → Returns WeaknessAnalysisResult

3. Student Asks Question
   POST /api/mentor/respond
   → MentorAIService.generate_response()
     ├─ Fetches StudentProfile
     ├─ Gets WeaknessScore for concept
     ├─ Determines explanation_style (simple/conceptual/deep)
     ├─ Calls LLM with adaptive prompt
     └─ Stores MentorResponse for audit
   → Returns MentorResponseData with response_id

4. Student Provides Feedback
   POST /api/feedback/submit
   → FeedbackService.submit_feedback()
     ├─ Stores Feedback record
     ├─ Analyzes feedback type (too_easy/too_hard/helpful)
     ├─ Adjusts StudentProfile.preferred_difficulty
     ├─ Adjusts StudentProfile.confidence_level
     └─ Computes AdaptationUpdate
   → Returns FeedbackResponse with adaptation_made=true

5. System Makes Recommendations
   GET /api/adaptive/recommendations/{student_id}
   → AdaptiveLearningService.get_student_context_snapshot()
   → Analyzes: weakness, confidence, sentiment
   → Returns [high-priority action items]

COMPLETE FLOW SUMMARY:
Profile → Quiz → Weakness Updated → Mentor Asked
  → Response with Difficulty-Adapted Explanation → Feedback Provided
  → Difficulty Adjusted → Confidence Updated → Recommendation Generated


TESTING STRATEGY
================

Unit Testing:
- Mock DB session for each service
- Test business logic in isolation
- Verify validation rules
- Assert error handling

Integration Testing:
- Real SQLite database
- Test data flow through multiple services
- Verify relationship integrity
- Check adaptation logic end-to-end

Example pytest fixture:
```python
@pytest.fixture
def db_session():
    # Create temporary SQLite in-memory DB
    engine = create_engine("sqlite:///:memory:")
    init_db()
    session = SessionLocal()
    yield session
    session.close()

def test_weakness_analyzer(db_session):
    service = WeaknessAnalyzerService(db_session)
    # Create test data
    # Call methods
    # Assert results
```


DEPLOYMENT CONSIDERATIONS
=======================

1. DATABASE MIGRATION
   - init_db() auto-creates tables on first run
   - Schema migration logic handles new columns
   - Use Alembic for production versioning

2. SCALABILITY
   - Stateless services allow horizontal scaling
   - Use connection pooling (SQLAlchemy Pool)
   - Consider caching: Redis for frequently accessed profiles

3. LLM INTEGRATION
   - Current: MentorAIService._generate_socratic_response() is placeholder
   - Replace with actual LLM call (OpenRouter/OpenAI)
   - Add retry logic, rate limiting, cost tracking

4. MONITORING
   - Log all LLM calls (cost, latency)
   - Track feedback sentiment trends
   - Monitor weakness distribution by concept
   - Alert on adaptation failures

5. SECURITY
   - Validate student_id in every request
   - Implement rate limiting
   - Use API keys for external services
   - Hash sensitive student data


CONFIGURATION
=============

Environment Variables (required):
- OPENROUTER_API_KEY
- DATABASE_URL (default: sqlite:///mentor_ai.db)
- OPENROUTER_BASE_URL (default: https://openrouter.ai/api/v1)

Optional:
- LOG_LEVEL
- MAX_FEEDBACK_HISTORY (default: 3)
- DIFFICULTY_RANGE (default: 1.0-5.0)


FILE STRUCTURE (AFTER REFACTORING)
==================================

app/
├── __init__.py
├── main.py                  ← FastAPI entry point
├── database.py              ← ORM models, enums, init_db
├── schemas.py               ← Pydantic validation models
├── services.py              ← Business logic (5 services)
│
├── models/
│   ├── __init__.py
│   └── (legacy: schemas.py, moved to root)
│
├── routes/
│   ├── __init__.py          ← Router imports
│   ├── profiles.py          ← NEW: Profile CRUD
│   ├── wellness.py          ← NEW: Quiz + weakness
│   ├── mentor_ai.py         ← NEW: Mentor responses
│   ├── feedback_loop.py      ← NEW: Feedback + adaptation
│   ├── adaptive.py          ← NEW: Adaptive control
│   ├── explain_mistakes.py   ← NEW: Misconception detection
│   ├── students.py          ← LEGACY: Keep for compatibility
│   ├── quiz.py              ← LEGACY
│   ├── mentor.py            ← LEGACY (conflicts with /api/mentor)
│   ├── feedback.py          ← LEGACY (conflicts with /api/feedback)
│   └── analytics.py         ← LEGACY: Read-only analytics
│
├── utils/
│   └── (future: validation helpers, constants)
│
└── __pycache__/

frontend/
├── index.html
└── static/
    └── style.css


MIGRATION GUIDE (FROM LEGACY TO NEW)
====================================

Old Endpoints → New Endpoints:
────────────────────────────────

Student Management:
OLD: POST /api/students/create
NEW: POST /api/profile/create

Profile Management:
OLD: [no dedicated endpoints]
NEW: POST /api/profile/{id}/profile
NEW: GET /api/profile/{id}
NEW: PUT /api/profile/{id}

Quiz Analysis:
OLD: POST /api/quiz/submit
NEW: POST /api/analyze/quiz

Weakness Tracking:
OLD: GET /api/quiz/weakest-concepts
NEW: GET /api/analyze/weakest-concepts/{id}

Mentor Responses:
OLD: POST /api/mentor/chat
NEW: POST /api/mentor/respond

Feedback:
OLD: POST /api/feedback/submit
NEW: POST /api/feedback/submit (compatible)

Analytics:
OLD: GET /api/analytics/*
NEW: [Same endpoints, read-only]

Adaptive Control:
OLD: [no dedicated endpoints]
NEW: GET /api/adaptive/status/{id}
NEW: GET /api/adaptive/recommendations/{id}

Misconception Detection:
OLD: [no dedicated endpoints]
NEW: POST /api/explain/mistake
NEW: POST /api/explain/misconception-check


BACKWARD COMPATIBILITY
======================

Old routers (students, quiz, mentor, feedback) still mounted at original paths.
New routers use /api prefix with feature-based organization.

Conflict Resolution:
- /api/mentor/* from both mentor.py (legacy) and mentor_ai.py (new)
- /api/feedback/* from both feedback.py (legacy) and feedback_loop.py (new)

Solution: New routers registered second, so they take precedence.
Monitor logs for duplicate endpoint warnings.


NEXT PHASES
===========

Phase 1 (DONE): Core Architecture
✅ Database models
✅ Pydantic schemas
✅ Service layer (5 services)
✅ New routers (6 routers)
✅ main.py integration

Phase 2 (NEXT): Complete LLM Integration
⏳ Replace _generate_socratic_response() placeholder
⏳ Implement _detect_misconception() with LLM
⏳ Add context from conversation history
⏳ Cost tracking and rate limiting

Phase 3: Testing & Monitoring
⏳ Comprehensive pytest suite
⏳ Integration tests
⏳ Performance benchmarks
⏳ Logging/monitoring infrastructure

Phase 4: Frontend Integration
⏳ Update frontend to use new endpoints
⏳ Real-time feedback loops
⏳ Progress visualization

Phase 5: Production Deployment
⏳ Database migrations (Alembic)
⏳ Environment configuration
⏳ Load testing
⏳ Monitoring/alerting setup


ADDITIONAL RESOURCES
===================

FastAPI Docs:
- Dependency Injection: https://fastapi.tiangolo.com/tutorial/dependencies/
- SQLAlchemy Integration: https://fastapi.tiangolo.com/advanced/sqlalchemy/
- Testing: https://fastapi.tiangolo.com/tutorial/testing/

SQLAlchemy ORM:
- Relationships: https://docs.sqlalchemy.org/en/20/orm/relationships.html
- Query: https://docs.sqlalchemy.org/en/20/orm/quickstart.html

Pydantic v2:
- Validation: https://docs.pydantic.dev/latest/concepts/validators/
- Serialization: https://docs.pydantic.dev/latest/concepts/serialization/
"""
