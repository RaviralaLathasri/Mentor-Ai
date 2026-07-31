"""FastAPI application entrypoint."""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.database import init_db
from app.routes import (
    adaptive,
    analytics,
    audio_interview,
    career,
    explain_mistakes,
    feedback_loop,
    interview,
    mentor_ai,
    profiles,
    resume,
    wellness,
)

app = FastAPI(
    title="AI Mentor System",
    description="Human-in-the-loop adaptive learning backend",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

cors_allow_origins = os.getenv("CORS_ALLOW_ORIGINS", "*")
origins = [item.strip() for item in cors_allow_origins.split(",") if item.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router)
app.include_router(wellness.router)
app.include_router(mentor_ai.router)
app.include_router(feedback_loop.router)
app.include_router(adaptive.router)
app.include_router(explain_mistakes.router)
app.include_router(analytics.router)
app.include_router(resume.router)
app.include_router(career.router)
app.include_router(interview.router)
app.include_router(audio_interview.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health", tags=["System"])
def health_check() -> dict:
    return {"status": "ok", "project": "Mentor AI", "version": "1.1.0"}


def _frontend_dist_dir() -> Path:
    # Default for Docker builds that copy Vite output to `/app/frontend/dist`.
    default = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    return Path(os.getenv("FRONTEND_DIST_DIR") or default)


_DIST_DIR = _frontend_dist_dir()
_INDEX_HTML = _DIST_DIR / "index.html"


if _INDEX_HTML.is_file():

    @app.get("/", include_in_schema=False)
    def serve_frontend_root():
        return FileResponse(_INDEX_HTML)

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend_paths(full_path: str):
        # Let real API routes win. If someone hits an unknown `/api/*` path, return 404 (not the SPA).
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        requested = _DIST_DIR / (full_path or "")
        if requested.is_file():
            return FileResponse(requested)

        # SPA fallback (React Router deep links)
        return FileResponse(_INDEX_HTML)

else:

    @app.get("/", include_in_schema=False)
    def home() -> dict:
        return {"message": "Mentor AI Backend Running Successfully"}
