from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


DEFAULT_BACKEND_HOST = "127.0.0.1"
DEFAULT_BACKEND_PORT = 8000
DEFAULT_FRONTEND_HOST = "127.0.0.1"
DEFAULT_FRONTEND_PORT = 5173
DEFAULT_HID_REPORT_GAP_MS = 25

DEFAULT_CONFIG: dict[str, Any] = {
    "server": {
        "host": DEFAULT_BACKEND_HOST,
        "port": DEFAULT_BACKEND_PORT,
        "reload": False,
    },
    "frontend": {
        "dist": "frontend/dist",
        "dev_server": {
            "host": DEFAULT_FRONTEND_HOST,
            "port": DEFAULT_FRONTEND_PORT,
        },
    },
    "cors": {
        "origins": [],
    },
    "storage": {
        "presets": "config/presets.yaml",
        "recordings": "recordings",
    },
    "hid": {
        "path": None,
        "report_gap_ms": DEFAULT_HID_REPORT_GAP_MS,
    },
    "safety": {
        "start_in_privacy": True,
    },
}


def project_root() -> Path:
    cwd = Path.cwd().resolve()
    for candidate in (cwd, *cwd.parents, _source_project_root()):
        if (candidate / "config" / "pixypilot.yaml").exists():
            return candidate
    return _source_project_root()


def config_file_path(config_path: Path | None = None) -> Path:
    if config_path is not None:
        return config_path
    return project_root() / "config" / "pixypilot.yaml"


def load_config(config_path: Path | None = None) -> dict[str, Any]:
    path = config_file_path(config_path).resolve()
    return _load_config_from_path(str(path))


def backend_host(config_path: Path | None = None) -> str:
    return _string_at(["server", "host"], DEFAULT_BACKEND_HOST, config_path)


def backend_port(config_path: Path | None = None) -> int:
    return _int_at(["server", "port"], DEFAULT_BACKEND_PORT, config_path)


def reload_enabled(config_path: Path | None = None) -> bool:
    return _bool_at(["server", "reload"], False, config_path)


def frontend_host(config_path: Path | None = None) -> str:
    return _string_at(["frontend", "dev_server", "host"], DEFAULT_FRONTEND_HOST, config_path)


def frontend_port(config_path: Path | None = None) -> int:
    return _int_at(["frontend", "dev_server", "port"], DEFAULT_FRONTEND_PORT, config_path)


def cors_origins(config_path: Path | None = None) -> list[str]:
    configured = _list_at(["cors", "origins"], config_path)
    if configured:
        return configured

    frontend = frontend_host(config_path)
    port = frontend_port(config_path)
    origins = {f"http://{frontend}:{port}"}
    if frontend in {"127.0.0.1", "localhost"}:
        origins.add(f"http://localhost:{port}")
        origins.add(f"http://127.0.0.1:{port}")
    return sorted(origins)


def frontend_dist_path(config_path: Path | None = None) -> Path:
    return _path_at(["frontend", "dist"], Path("frontend/dist"), config_path)


def presets_path(config_path: Path | None = None) -> Path:
    return _path_at(["storage", "presets"], Path("config/presets.yaml"), config_path)


def recordings_dir(config_path: Path | None = None) -> Path:
    return _path_at(["storage", "recordings"], Path("recordings"), config_path)


def hid_path_override(config_path: Path | None = None) -> Path | None:
    raw_value = _value_at(["hid", "path"], config_path)
    if raw_value is None or raw_value == "":
        return None
    return _resolve_path(Path(str(raw_value)), config_path)


def hid_report_gap_seconds(config_path: Path | None = None) -> float:
    milliseconds = _int_at(["hid", "report_gap_ms"], DEFAULT_HID_REPORT_GAP_MS, config_path)
    return max(0, milliseconds) / 1000


def start_in_privacy(config_path: Path | None = None) -> bool:
    return _bool_at(["safety", "start_in_privacy"], True, config_path)


def reset_config_cache_for_tests() -> None:
    _load_config_from_path.cache_clear()


@lru_cache(maxsize=8)
def _load_config_from_path(path_text: str) -> dict[str, Any]:
    path = Path(path_text)
    loaded: dict[str, Any] = {}
    if path.exists():
        raw_config = yaml.safe_load(path.read_text(encoding="utf-8"))
        if raw_config is None:
            loaded = {}
        elif isinstance(raw_config, dict):
            loaded = _string_keys(raw_config)
        else:
            raise ValueError("PixyPilot config must be a YAML mapping")

    return _deep_merge(DEFAULT_CONFIG, loaded)


def _source_project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _value_at(path: list[str], config_path: Path | None = None) -> Any:
    value: Any = load_config(config_path)
    for key in path:
        if not isinstance(value, dict) or key not in value:
            return None
        value = value[key]
    return value


def _string_at(path: list[str], default: str, config_path: Path | None = None) -> str:
    value = _value_at(path, config_path)
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def _int_at(path: list[str], default: int, config_path: Path | None = None) -> int:
    value = _value_at(path, config_path)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _bool_at(path: list[str], default: bool, config_path: Path | None = None) -> bool:
    value = _value_at(path, config_path)
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
    return default


def _list_at(path: list[str], config_path: Path | None = None) -> list[str]:
    value = _value_at(path, config_path)
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _path_at(path: list[str], default: Path, config_path: Path | None = None) -> Path:
    raw_value = _value_at(path, config_path)
    if raw_value is None or raw_value == "":
        raw_path = default
    else:
        raw_path = Path(str(raw_value))
    return _resolve_path(raw_path, config_path)


def _resolve_path(path: Path, config_path: Path | None = None) -> Path:
    if path.is_absolute():
        return path
    if config_path is None:
        return project_root() / path
    config_parent = config_file_path(config_path).resolve().parent
    if config_parent.name == "config":
        return config_parent.parent / path
    return config_parent / path


def _deep_merge(defaults: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    merged = dict(defaults)
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _string_keys(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _string_keys(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_string_keys(item) for item in value]
    return value
