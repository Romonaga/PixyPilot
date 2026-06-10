import os
from pathlib import Path


DEFAULT_BACKEND_HOST = "127.0.0.1"
DEFAULT_BACKEND_PORT = 8000
DEFAULT_FRONTEND_HOST = "127.0.0.1"
DEFAULT_FRONTEND_PORT = 5173


def backend_host() -> str:
    return os.environ.get("PIXYPILOT_HOST", DEFAULT_BACKEND_HOST)


def backend_port() -> int:
    return _int_env("PIXYPILOT_PORT", DEFAULT_BACKEND_PORT)


def frontend_host() -> str:
    return os.environ.get("PIXYPILOT_FRONTEND_HOST", DEFAULT_FRONTEND_HOST)


def frontend_port() -> int:
    return _int_env("PIXYPILOT_FRONTEND_PORT", DEFAULT_FRONTEND_PORT)


def cors_origins() -> list[str]:
    configured = os.environ.get("PIXYPILOT_CORS_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    frontend = frontend_host()
    port = frontend_port()
    origins = {f"http://{frontend}:{port}"}
    if frontend in {"127.0.0.1", "localhost"}:
        origins.add(f"http://localhost:{port}")
        origins.add(f"http://127.0.0.1:{port}")
    return sorted(origins)


def frontend_dist_path() -> Path:
    configured = os.environ.get("PIXYPILOT_FRONTEND_DIST")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[3] / "frontend" / "dist"


def _int_env(name: str, default: int) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default
