"""
Central logging configuration for Mentor AI.

Goal: make VS Code terminal logs compact, readable, and consistent across:
- FastAPI application logs
- Uvicorn server logs

Use `python -m app.devserver` (recommended for local dev) to apply this config.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional


def _coerce_level(value: str, default: str = "INFO") -> str:
    raw = (value or "").strip().upper()
    if not raw:
        return default
    if raw == "TRACE":
        return "DEBUG"
    if raw in ("CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"):
        return raw
    return default


def _repo_root() -> Path:
    # app/logging_setup.py -> repo root is one level up
    return Path(__file__).resolve().parents[1]


def _default_log_config_path() -> Path:
    return _repo_root() / "logging.json"


def _load_json_log_config(path: Path) -> Optional[Dict[str, Any]]:
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    except Exception:
        return None

    try:
        parsed = json.loads(raw)
    except Exception:
        return None

    return parsed if isinstance(parsed, dict) else None


def _truthy_env(name: str) -> bool:
    raw = (os.getenv(name) or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def build_uvicorn_log_config() -> Dict[str, Any]:
    """
    Return a `logging.config.dictConfig` compatible dictionary for Uvicorn.

    Notes:
    - We set `uvicorn.access` to WARNING by default to avoid noisy per-request logs.
    - Change `UVICORN_ACCESS_LOG_LEVEL` or `UVICORN_ACCESS_LOG=1` if you want access logs.
    """

    log_level = _coerce_level(os.getenv("LOG_LEVEL", "INFO"), default="INFO")
    access_default = "INFO" if _truthy_env("UVICORN_ACCESS_LOG") else "WARNING"
    access_level = _coerce_level(os.getenv("UVICORN_ACCESS_LOG_LEVEL", access_default), default=access_default)

    datefmt = os.getenv("LOG_DATEFMT", "%Y-%m-%d %H:%M:%S")

    # `use_colors` is respected by uvicorn.logging.* formatters.
    use_colors_env = (os.getenv("LOG_COLORS") or "").strip().lower()
    use_colors: Optional[bool]
    if use_colors_env in ("1", "true", "yes", "on"):
        use_colors = True
    elif use_colors_env in ("0", "false", "no", "off"):
        use_colors = False
    else:
        use_colors = None

    config_path = Path(os.getenv("LOG_CONFIG_PATH") or _default_log_config_path())
    config = _load_json_log_config(config_path)
    if not config:
        config = {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "()": "uvicorn.logging.DefaultFormatter",
                    "fmt": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
                    "datefmt": datefmt,
                    "use_colors": use_colors,
                },
                "access": {
                    "()": "uvicorn.logging.AccessFormatter",
                    "fmt": '%(asctime)s | %(levelname)s | %(client_addr)s - "%(request_line)s" %(status_code)s',
                    "datefmt": datefmt,
                    "use_colors": use_colors,
                },
            },
            "handlers": {
                "default": {"class": "logging.StreamHandler", "formatter": "default", "stream": "ext://sys.stderr"},
                "access": {"class": "logging.StreamHandler", "formatter": "access", "stream": "ext://sys.stdout"},
            },
            "root": {"level": log_level, "handlers": ["default"]},
            "loggers": {
                "uvicorn": {"handlers": ["default"], "level": log_level, "propagate": False},
                "uvicorn.error": {"level": log_level},
                "uvicorn.access": {"handlers": ["access"], "level": access_level, "propagate": False},
                "uvicorn.asgi": {"level": "WARNING"},
                "httpx": {"level": "WARNING"},
                "openai": {"level": "WARNING"},
                "sqlalchemy.engine": {"level": "WARNING"},
                "watchfiles": {"level": "WARNING"},
                "asyncio": {"level": "WARNING"},
            },
        }

    # Apply env overrides to both the JSON template and the fallback config.
    config.setdefault("root", {})
    if isinstance(config.get("root"), dict):
        config["root"]["level"] = log_level

    loggers = config.get("loggers")
    if not isinstance(loggers, dict):
        loggers = {}
        config["loggers"] = loggers

    for key in ("uvicorn", "uvicorn.error"):
        logger_cfg = loggers.get(key)
        if not isinstance(logger_cfg, dict):
            logger_cfg = {}
            loggers[key] = logger_cfg
        logger_cfg["level"] = log_level

    access_cfg = loggers.get("uvicorn.access")
    if not isinstance(access_cfg, dict):
        access_cfg = {}
        loggers["uvicorn.access"] = access_cfg
    access_cfg["level"] = access_level

    formatters = config.get("formatters")
    if isinstance(formatters, dict):
        for formatter_name in ("default", "access"):
            formatter_cfg = formatters.get(formatter_name)
            if isinstance(formatter_cfg, dict):
                formatter_cfg["datefmt"] = datefmt
                formatter_cfg["use_colors"] = use_colors

    return config


def configure_logging(*, force: bool = False) -> None:
    """
    Configure logging via `logging.config.dictConfig`.

    By default, this is a no-op if handlers already exist (e.g. when Uvicorn has
    configured logging). Use `force=True` to override existing handlers.
    """
    if not force:
        root = logging.getLogger()
        if root.handlers:
            return

    import logging.config

    logging.config.dictConfig(build_uvicorn_log_config())


def configure_logging_if_needed() -> None:
    """
    Backwards-compatible alias.

    When running through Uvicorn with a custom `log_config`, you don't need this.
    """
    configure_logging(force=False)
