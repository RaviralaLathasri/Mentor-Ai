# Architecture Visual Guide

This document provides visual diagrams and maps of the complete system.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HUMAN-IN-THE-LOOP MENTOR AI                        │
│                        Production-Ready Backend (v1.0)                      │
└────────────────────────────────────────────────────────────────────────────┬┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
          ┌──────────────────┐            ┌──────────────────┐
          │   Frontend Calls │            │ External Services│
          │   (React/Vue)    │            │  (OpenRouter AI) │
          └──────────┬───────┘            └────────┬─────────┘
                     │                             │
                     └────────────┬────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   FASTAPI APPLICATION     │
                    │   (app/main.py)           │
                    │ - CORS enabled            │
                    │ - All routers registered  │
                    │ - DB initialization       │
                    └──────────┬────────────────┘
                               │
          ┌────────────────────┼─────────────────────┐
          │                    │                     │
          ▼                    ▼                     ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
    │   ROUTERS    │  │   ROUTERS    │  │   ROUTERS        │
    │ (NEW)        │  │ (NEW)        │  │ (LEGACY)         │
    │              │  │              │  │                  │
    │ profiles     │  │ wellness     │  │ students         │
    │ mentor_ai    │  │ feedback     │  │ quiz             │
    │ adaptive     │  │ mentor_ai    │  │ mentor           │
    │ explain      │  │ adaptive     │  │ feedback         │
    │              │  │              │  │ analytics        │
    └─────┬────────┘  └──────┬───────┘  └────────┬─────────┘
          │                  │                    │
          └──────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  SERVICE LAYER  │
                    │  (services.py)  │
                    │                 │
                    │ 5 Services:     │
                    │ • Profile       │
                    │ • Weakness      │
                    │ • Mentor AI     │
                    │ • Feedback      │
                    │ • Adaptive      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  ORM LAYER      │
                    │ (database.py)   │
                    │                 │
                    │ 6 Models:       │
                    │ • Student       │
                    │ • Profile       │
                    │ • Weakness      │
                    │ • Feedback      │
                    │ • Response      │
                    │ • Session       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ SQLite DATABASE │
                    │ (mentor_ai.db)  │
                    └─────────────────┘
```

## Project Structure

```
OnCallAgent/
│
├── 📋 Documentation (NEW)
│   ├── README.md                    ← Start here!
│   ├── ARCHITECTURE.md              ← System design
│   ├── COMPLETION_CHECKLIST.md      ← What's done
│   ├── DEVELOPER_REFERENCE.md       ← Code patterns
│   ├── DEPLOYMENT_GUIDE.md          ← How to deploy
│   ├── DOCUMENTATION_INDEX.md       ← Navigation
│   ├── PROJECT_DELIVERY.md          ← This summary
│   └── 📊 ARCHITECTURE_VISUAL.md    ← You are here
│
├── 🐍 app/
│   │
│   ├── 🗄️ Core Files (NEW)
│   │   ├── database.py              ← ORM models, enums, init
│   │   ├── schemas.py               ← Pydantic validation
│   │   └── services.py              ← 5 business logic services
│   │
│   ├── 🛣️ routes/ (UPDATED)
│   │   ├── 📍 NEW MODULAR ROUTERS
│   │   │   ├── profiles.py          ← /api/profile/*
│   │   │   ├── wellness.py          ← /api/analyze/*
│   │   │   ├── mentor_ai.py         ← /api/mentor/respond
│   │   │   ├── feedback_loop.py     ← /api/feedback/*
│   │   │   ├── adaptive.py          ← /api/adaptive/*
│   │   │   └── explain_mistakes.py  ← /api/explain/*
│   │   │
│   │   ├── 📍 LEGACY ROUTERS (backward compatible)
│   │   │   ├── students.py          ← /api/students/*
│   │   │   ├── quiz.py              ← /api/quiz/*
│   │   │   ├── mentor.py            ← /api/mentor/* (legacy)
│   │   │   ├── feedback.py          ← /api/feedback/* (legacy)
│   │   │   └── analytics.py         ← /api/analytics/*
│   │   │
│   │   └── __init__.py              ← Router exports
│   │
│   ├── 📦 models/
│   │   ├── __init__.py
│   │   └── schemas.py               ← Legacy (moved to root)
│   │
│   ├── 🔧 utils/
│   │   └── (future utilities)
│   │
│   ├── ⚙️ main.py                   ← FastAPI entry point (UPDATED)
│   ├── store.py                     ← Legacy database utilities
│   │
│   └── __pycache__/
│
├── 🎨 frontend/
│   ├── index.html
│   └── static/
│       └── style.css
│
├── 📄 requirements.txt
├── 🛡️ .env                           ← Configuration (create this)
│
└── 💾 mentor_ai.db                   ← SQLite (auto-created)
```

## Service Layer Dependencies

```
                    ┌──────────────────────────┐
                    │  ADAPTIVE LEARNING       │
                    │  SERVICE (Orchestrator)  │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌─────────────┐  ┌──────────────┐  ┌───────────┐
        │  PROFILE    │  │  WEAKNESS    │  │  MENTOR   │
        │  SERVICE    │  │  SERVICE     │  │  AI       │
        │             │  │              │  │  SERVICE  │
        │ - Create    │  │ - Analyze    │  │           │
        │ - Update    │  │ - Track      │  │ - Context │
        │ - Context   │  │ - Priority   │  │ - Style   │
        │             │  │ - Misconc.   │  │ - Concept │
        └─────────────┘  └──────────────┘  └──────┬────┘
              ▲                    ▲               │
              │                    │               │
              └────────────────────┼───────────────┘
                                   │
              ┌────────────────────┴───────────┐
              │                                │
              ▼                                ▼
        ┌──────────────────┐        ┌──────────────────┐
        │  FEEDBACK        │        │  DATABASE        │
        │  SERVICE         │        │  (SQLAlchemy     │
        │                  │        │   ORM)           │
        │ - Submit         │        │                  │
        │ - Adapt          │        │ - Student        │
        │ - Difficulty     │        │ - Profile        │
        │ - Confidence     │        │ - Weakness       │
        │                  │        │ - Feedback       │
        └──────────────────┘        │ - Response       │
                                    │ - Session        │
                                    └──────────────────┘
                                            ▲
                                            │
                                    ┌───────▼───────┐
                                    │ SQLite File   │
                                    │ mentor_ai.db  │
                                    └───────────────┘

KEY: All services depend on DB session (dependency injection)
```

## Router Organization

```
                          FASTAPI APP
                                │
                ┌───────────────┼───────────────┐
                │                               │
        ┌───────▼────────┐          ┌──────────▼──────────┐
        │  NEW ROUTERS   │          │  LEGACY ROUTERS    │
        │  (Modular)     │          │  (Backward Compat)  │
        └───────┬────────┘          └──────────┬──────────┘
                │                             │
        ┌───────┴─────────┐              ┌────┴─────┐
        │                 │              │          │
    ┌───▼────┐  ┌────▼────┐        ┌──▼──┐  ┌───▼──┐
    │ Profiles│  │ Wellness│        │Quiz │  │Mentor│
    │ (CRUD)  │  │(Analysis)       │(CRUD)  │(Chat)│
    └────┬────┘  └────┬────┘        └──┬──┘  └───┬──┘
         │            │                 │        │
         └─────┬──────┘                 │        │
         ┌─────▼─────────┐              │        │
         │MentorAI       │              │        │
         │FeedbackLoop    │              │        │
         │Adaptive        │              │        │
         │ExplainMistakes │              │        │
         └─────┬──────────┘              │        │
               │                         │        │
               └─────────────┬───────────┴────────┘
                             │
                      ┌──────▼──────┐
                      │  ALL USE    │
                      │  SERVICES   │
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │  DATABASE   │
                      └─────────────┘

ALL LOGIC IN SERVICES, NOT IN ROUTERS!
```

## Database Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                         STUDENT (Root)                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────────┐  │
│  │ id       │ name     │ email    │ created  │ *relations   │  │
│  └─────┬────┴──────────┴──────────┴──────────┴──────────────┘  │
└────────┼──────────────────────────────────────────────────────┘
         │
    ┌────┴──────────────────────────────────────────────────┐
    │                                                        │
  1:1                                                      1:N
    │                                                        │
    ▼                                                        ▼
┌───────────────┐                                  ┌──────────────────┐
│PROFILE (1:1)  │                                  │WEAKNESS (1:N)    │
├───────────────┤                                  ├──────────────────┤
│student_id*FK  │                                  │student_id*FK     │
│confidence     │                                  │concept_name      │
│difficulty     │                                  │weakness_score    │
│skills         │                                  │updated_at        │
│interests      │                                  └──────────────────┘
│goals          │
└───────────────┘

                                                        ┌──────────────────┐
                                                        │FEEDBACK (1:N)    │
    ┌─────────────────────────────────────────────────┤──────────────────┤
    │                                                  │student_id*FK     │
    │                                                  │response_id       │
    │                                                  │feedback_type     │
    │                                                  │rating            │
    │                                                  │comments          │
    │                                                  │focus_concept     │
    │                                                  │created_at        │
    │                                                  └──────────────────┘
    │
    │                                                        ┌──────────────────┐
    │                                                        │RESPONSE (1:N)    │
    │    ┌─────────────────────────────────────────────────┤──────────────────┤
    │    │                                                  │response_id*UQ    │
    │    │                                                  │student_id*FK     │
    │    │                                                  │query             │
    │    │                                                  │response          │
    │    │                                                  │explanation_style │
    │    │                                                  │target_concept    │
    │    │                                                  │created_at        │
    │    │                                                  └──────────────────┘
    │    │
    │    │                                                        ┌──────────────────┐
    │    │                                                        │SESSION (1:N)     │
    │    │    ┌─────────────────────────────────────────────────┤──────────────────┤
    │    │    │                                                  │session_id*PK     │
    │    │    │                                                  │student_id*FK     │
    │    │    │                                                  │topic             │
    │    │    │                                                  │difficulty        │
    │    │    │                                                  │interaction_count │
    │    │    │                                                  │started_at        │
    │    │    │                                                  │ended_at          │
    │    │    │                                                  └──────────────────┘
    │    │    │
    └────┴────┴─────────────────────────────────────────────────────────────┘

Legend:
- * = Foreign Key
- *UQ = Unique Constraint
- 1:1 = One-to-One Relationship
- 1:N = One-to-Many Relationship
```

## Complete Data Flow: Student Takes Quiz

```
START
  │
  ▼
Student uploads answer "2x + 3 = 7"
  │
  ▼
  ┌──────────────────────────────────────────────────┐
  │ POST /api/analyze/quiz                           │
  │ {                                                │
  │   student_id: 1,                                 │
  │   concept_name: "algebra",                       │
  │   is_correct: false,                             │
  │   student_answer: "2x + 3 = 7",                 │
  │   correct_answer: "x = 2"                        │
  │ }                                                │
  └──────────────────────────────────────────────────┘
  │
  ▼
  ┌──────────────────────────────────────────────────┐
  │ Router: wellness.py                              │
  │ - Validates input                                │
  │ - Calls service                                  │
  └──────────────────────────────────────────────────┘
  │
  ▼
  ┌──────────────────────────────────────────────────┐
  │ Service: WeaknessAnalyzerService                 │
  │ - Get/create weakness record for "algebra"       │
  │ - Old weakness: 0.5                              │
  │ - Apply algorithm: +0.15 (wrong answer)          │
  │ - New weakness: 0.65                             │
  │ - Detect misconception                           │
  │ - Calculate priority: "high"                      │
  │ - Save to database                               │
  └──────────────────────────────────────────────────┘
  │
  ▼
RESPONSE
  {
    "concept": "algebra",
    "is_correct": false,
    "old_weakness": 0.5,
    "new_weakness": 0.65,
    "misconception": "...",
    "priority": "high"
  }
  │
  ▼
  ┌──────────────────────────────────────────────────┐
  │ Frontend receives data                           │
  │ - Shows "Incorrect" message                      │
  │ - Offers mentor help button                      │
  │ - Suggests practice more on algebra              │
  └──────────────────────────────────────────────────┘
  │
  ▼
  NEXT: Student can ask mentor (POST /api/mentor/respond)
        → MentorAIService will:
            1. Load student profile
            2. See weakness = 0.65 + low confidence
            3. Select style = "conceptual"
            4. Generate explanation with examples
            5. Return response with follow-up question
  │
  ▼
END
```

## State Transitions: Feedback Loop

```
┌─────────────────────────────────────────┐
│ Student Receives Mentor Response        │
│ Difficulty = MEDIUM                     │
│ Confidence = 0.5                        │
└──────────────┬──────────────────────────┘
               │
         ┌─────┴─────┐
         │           │
         ▼           ▼
    ┌────────┐   ┌────────┐
    │ Reads  │   │ Thinks │
    │Answer  │   │About   │
    │Helpful │   │Answer  │
    └────┬───┘   └────┬───┘
         │            │
         ▼            ▼
┌────────────────────────────────────────────┐
│ Student submits FEEDBACK                   │
│ POST /api/feedback/submit                  │
│ {                                          │
│   feedback_type: "too_hard" (or "helpful")│
│   rating: 2.0                             │
│ }                                          │
└────────┬──────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ FeedbackService._adapt_to_feedback()       │
│                                            │
│ Last 3 feedbacks:                          │
│ [too_hard, too_hard, helpful]             │
│                                            │
│ Scores: [-1, -1, 0]                       │
│ Average: -0.67                             │
│                                            │
│ Rule: avg <= -0.5                         │
│ Action: difficulty -= 1                    │
│                                            │
│ Also: rating=2.0 ≤ 2.0                    │
│ Action: confidence -= 0.1                  │
└────────┬──────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Database Updated                           │
│                                            │
│ StudentProfile:                            │
│ - difficulty: MEDIUM → EASY ✓              │
│ - confidence: 0.5 → 0.4 ✓                  │
│ - timestamp: updated_at                    │
└────────┬──────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Response to Student                        │
│                                            │
│ {                                          │
│   "adaptation_made": true,                 │
│   "previous_difficulty": "medium",         │
│   "new_difficulty": "easy",                │
│   "reason": "Content was too hard"         │
│ }                                          │
└────────┬──────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Next Mentor Response (different!)          │
│ NowDifficulty = EASY                       │
│ Confidence = 0.4                           │
│                                            │
│ → Style = "simple" (because confidence)    │
│ → Explanation = very basic steps           │
│ → Very supportive tone                     │
└─────────────────────────────────────────────┘
```

## HTTP Request/Response Flow

```
CLIENT (Frontend)
  │
  │ POST /api/feedback/submit
  │ Content-Type: application/json
  │ {
  │   "student_id": 1,
  │   "response_id": "uuid-...",
  │   "feedback_type": "too_hard",
  │   "rating": 2.5,
  │   "focus_concept": "quadratic_equations"
  │ }
  │
  ▼
┌────────────────────────────────────────┐
│ FASTAPI (main.py)                      │
│ - Route matching                       │
│ - CORS check                           │
│ - Dependency injection (get_db)        │
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ ROUTER (feedback_loop.py)              │
│ - Parse JSON via FeedbackSubmit schema │
│ - Validate input (Pydantic)            │
│ - Error handling try-except            │
│ - Create service                       │
│ - Call service method                  │
│ - Return response                      │
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ SERVICE (FeedbackService)              │
│ - Business logic                       │
│ - Database queries (SQLAlchemy ORM)    │
│ - Calculations and updates             │
│ - Return result objects                │
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ DATABASE (SQLAlchemy ORM)              │
│ - Load StudentProfile                  │
│ - Create Feedback record               │
│ - Update StudentProfile                │
│ - Commit transaction                   │
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ FILE SYSTEM (SQLite)                   │
│ mentor_ai.db                           │
│ - Written to disk                      │
│ - Transaction persisted                │
└────────┬─────────────────────────────┘
         │
         ▼ (Response travels back)
┌────────────────────────────────────────┐
│ Response Object Created                │
│ FeedbackResponse {                     │
│   student_id: 1,                       │
│   feedback_id: 42,                     │
│   adaptation_made: true,               │
│   previous_difficulty: "medium",       │
│   new_difficulty: "easy"               │
│ }                                      │
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ HTTP Response (200 OK)                 │
│ Content-Type: application/json         │
│ {                                      │
│   "student_id": 1,                     │
│   "feedback_id": 42,                   │
│   "adaptation_made": true,             │
│   "previous_difficulty": "medium",     │
│   "new_difficulty": "easy",            │
│   "submitted_at": "2024-01-15T..."     │
│ }                                      │
└────────┬─────────────────────────────┘
         │
         ▼
CLIENT (Frontend)
  Receives JSON response
  Updates UI
  Shows "Difficulty adjusted to EASY"
  Next mentor response will be simpler
```

## Scaling Architecture (Phase 5)

```
Current (Development):
┌──────────────────┐
│  Single Server   │
│  - FastAPI       │
│  - SQLite DB     │
└──────────────────┘

Phase 5 (Production):
                        ┌─────────────┐
                        │   CDN       │
                        │ (Static)    │
                        └──────┬──────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
    ┌────────┐          ┌────────┐          ┌────────┐
    │ Server │          │ Server │   (LB)   │ Server │
    │   1    ├──┬───────┤   2    ├──────────┤   3    │
    │ (Port  │  │       │        │          │        │
    │ 8000)  │  │       └────────┘          └────────┘
    └────────┘  │
               │
        ┌──────┼──────┐         ┌──────────────────┐
        │      │      │         │   Redis Cache    │
        ▼      ▼      ▼         │ (Session/Profile)│
    ┌───────────────────────┐   └──────────────────┘
    │   PostgreSQL Database │                │
    │   - Replicas          │                │
    │   - Backups           │◄───────────────┘
    │   - Connection Pool   │
    └───────────────────────┘

Key Improvements:
✓ Load balancer distributes traffic
✓ Multiple server instances (stateless)
✓ PostgreSQL >= SQLite
✓ Redis for caching profiles, sessions
✓ Database replicas for high availability
✓ Monitoring & alerting on all components
```

---

## Key Files Quick Reference

| File | Lines | Purpose | When to Edit |
|------|-------|---------|--------------|
| `database.py` | 400+ | ORM models | Adding new entities |
| `schemas.py` | 350+ | Validation | New API types |
| `services.py` | 500+ | Business logic | New algorithms |
| `routes/*.py` | 150-200 each | HTTP endpoints | New APIs |
| `main.py` | 84 | App setup | Register new routers |

---

## API Endpoint Map

```
/api/profile/
  POST /create              Create student
  POST /{id}/profile        Create profile
  GET /{id}                 Get profile
  PUT /{id}                 Update profile

/api/analyze/
  POST /quiz                Analyze quiz answer
  GET /weakest-concepts/{id} Get weakest concepts

/api/mentor/
  POST /respond             Get mentor response

/api/feedback/
  POST /submit              Submit feedback
  POST /rate-response       Quick rating

/api/adaptive/
  POST /session             Create session
  GET /status/{id}          Get status
  GET /recommendations/{id} Get recommendations

/api/explain/
  POST /mistake             Explain wrong answer
  POST /misconception-check Quick check

/api/analytics/
  GET /feedback-distribution/{id}
  GET /performance-over-time/{id}
  GET /weakest-concepts/{id}
  GET /confidence-trend/{id}
  GET /summary/{id}
  GET /weakest-concepts-graph/{id}

/health                     Health check
/docs                       Swagger UI
/redoc                      ReDoc UI
```

---

This visual guide should help you understand:
- System architecture
- How components interact
- Data flow through the system
- Service dependencies
- Database relationships
- HTTP request flow
- Future scaling approach

Pair this with README.md for text-based explanations!
