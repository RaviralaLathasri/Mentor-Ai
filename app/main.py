"""FastAPI application entrypoint."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import adaptive, analytics, explain_mistakes, feedback_loop, mentor_ai, profiles, wellness

app = FastAPI(
    title="AI Mentor System",
    description="Human-in-the-loop adaptive learning backend",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

allowed_origins = os.getenv("CORS_ALLOW_ORIGINS", "*")
origins = [item.strip() for item in allowed_origins.split(",") if item.strip()]
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


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health", tags=["System"])
def health_check() -> dict:
    return {"status": "ok", "project": "Mentor AI", "version": "1.1.0"}


@app.get("/")
def home() -> dict:
    return {"message": "Mentor AI Backend Running Successfully"}
