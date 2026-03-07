"""
main.py
-------
FastAPI application entry point.
- Registers all route modules
- Initializes the database on startup
- Serves the frontend static files
- Enables CORS so the HTML frontend can call the API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.database import init_db

# Import route modules — NEW MODULAR ARCHITECTURE
from app.routes import profiles, wellness, mentor_ai, feedback_loop, adaptive, explain_mistakes
# Legacy routes (for backward compatibility) — commented out due to dependency on removed adaptive_engine
# from app.routes import students, quiz, mentor, feedback, analytics

# ── App Initialization ────────────────────────────────────────────────────────
app = FastAPI(
    title="Human-in-the-Loop Adaptive Mentor AI",
    description="BTech Major Project — Personalized learning with real-time human feedback",
    version="1.0.0",
    docs_url="/docs",       # Swagger UI at /docs
    redoc_url="/redoc"      # ReDoc at /redoc
)

# ── CORS — allow frontend to call API ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # Restrict to specific domain in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ──────────────────────────────────────────────────────────
# NEW MODULAR ARCHITECTURE — Organized by feature with dependency injection
app.include_router(profiles.router,         tags=["Profile Management"])
app.include_router(wellness.router,         tags=["Learning Wellness"])
app.include_router(mentor_ai.router,        tags=["AI Mentor"])
app.include_router(feedback_loop.router,    tags=["Feedback Loop"])
app.include_router(adaptive.router,         tags=["Adaptive Learning"])
app.include_router(explain_mistakes.router, tags=["Mistake Explanation"])

# LEGACY ROUTES — Maintained for backward compatibility (disabled due to removed adaptive_engine dependency)
# app.include_router(students.router,  prefix="/api/students",  tags=["Students (Legacy)"])
# app.include_router(quiz.router,      prefix="/api/quiz",      tags=["Quiz & Weakness (Legacy)"])
# app.include_router(mentor.router,    prefix="/api/mentor",    tags=["Mentor AI (Legacy)"])
# app.include_router(feedback.router,  prefix="/api/feedback",  tags=["Feedback Loop (Legacy)"])
# app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics (Legacy)"])

# ── Serve Frontend Static Files ───────────────────────────────────────────────
"""
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")

    @app.get("/", include_in_schema=False)
    def serve_frontend():
        Serve the main HTML page.
        return FileResponse(os.path.join(frontend_path, "index.html"))
"""

# ── Startup Event ─────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    """Initialize database tables when the server starts."""
    init_db()
    print("✅ Database initialized")
    print("📖 API docs available at: http://localhost:8000/docs")

# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "project": "Mentor AI", "version": "1.0.0"}

@app.get("/")
def home():
    return {"message": "Mentor AI Backend Running Successfully"}