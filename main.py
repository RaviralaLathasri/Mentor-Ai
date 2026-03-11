"""
ASGI entrypoint for production deployments.

Required start command:
  uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from app.logging_setup import configure_logging

configure_logging(force=True)

from app.main import app  # noqa: E402  (import after logging config)

__all__ = ["app"]
