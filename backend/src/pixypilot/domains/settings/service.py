import os
from pathlib import Path
from typing import Any

import yaml

from pixypilot.domains.settings.models import AppSettings


def default_settings_path() -> Path:
    configured = os.environ.get("PIXYPILOT_SETTINGS_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[5] / "config" / "pixypilot.yaml"


class SettingsService:
    def __init__(self, settings_path: Path | None = None) -> None:
        self.settings_path = settings_path or default_settings_path()

    async def get_settings(self) -> AppSettings:
        if not self.settings_path.exists():
            return AppSettings()

        raw_settings = yaml.safe_load(self.settings_path.read_text(encoding="utf-8"))
        if raw_settings is None:
            return AppSettings()
        if not isinstance(raw_settings, dict):
            raise ValueError("PixyPilot settings must be a YAML mapping")

        return AppSettings.model_validate(_string_keys(raw_settings))


def _string_keys(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _string_keys(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_string_keys(item) for item in value]
    return value


def get_settings_service() -> SettingsService:
    return SettingsService()
