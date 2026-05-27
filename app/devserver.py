"""
Local development server entry point.

Why:
- Uses a clean log format in VS Code terminal.
- Loads `.env` without requiring VS Code terminal env injection.

Run:
  .\\venv\\Scripts\\python -m app.devserver
"""

from __future__ import annotations

import os

import uvicorn

from app.logging_setup import build_uvicorn_log_config


def _env_flag(name: str, default: str = "0") -> bool:
    raw = (os.getenv(name) or default).strip().lower()
    return raw in ("1", "true", "yes", "on")


def main() -> None:
    host = (os.getenv("HOST") or "127.0.0.1").strip()
    port = int(os.getenv("PORT") or "8000")

    # Default to reload for dev.
    reload = _env_flag("UVICORN_RELOAD", default="1")

    # Default to OFF to keep logs clean. Enable via UVICORN_ACCESS_LOG=1.
    access_log = _env_flag("UVICORN_ACCESS_LOG", default="0")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
        access_log=access_log,
        env_file=os.getenv("ENV_FILE") or ".env",
        log_config=build_uvicorn_log_config(),
        # Keep `log_level=None` so our log_config controls levels.
        log_level=None,
    )


if __name__ == "__main__":
    main()

