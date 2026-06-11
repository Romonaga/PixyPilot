from pathlib import Path
from typing import Any

import yaml

from pixypilot import config
from pixypilot.domains.settings.models import (
    AppSettings,
    AppSettingsUpdate,
    ConfigSettings,
    FrontendSettings,
    HidSettings,
    SafetySettings,
    ServerSettings,
    StorageSettings,
)


def default_settings_path() -> Path:
    return config.config_file_path()


class SettingsService:
    def __init__(self, settings_path: Path | None = None) -> None:
        self.settings_path = settings_path or default_settings_path()

    async def get_settings(self) -> AppSettings:
        config.load_config(self.settings_path)
        host = config.backend_host(self.settings_path)
        port = config.backend_port(self.settings_path)
        hid_path = config.hid_path_override(self.settings_path)

        return AppSettings(
            safety=SafetySettings(start_in_privacy=config.start_in_privacy(self.settings_path)),
            server=ServerSettings(
                host=host,
                port=port,
                reload=config.reload_enabled(self.settings_path),
                url=f"http://{host}:{port}",
            ),
            frontend=FrontendSettings(
                dist_path=str(config.frontend_dist_path(self.settings_path)),
                dev_server_host=config.frontend_host(self.settings_path),
                dev_server_port=config.frontend_port(self.settings_path),
                single_port=True,
            ),
            storage=StorageSettings(
                presets_path=str(config.presets_path(self.settings_path)),
                recordings_dir=str(config.recordings_dir(self.settings_path)),
            ),
            hid=HidSettings(
                path=str(hid_path) if hid_path is not None else None,
                report_gap_ms=round(config.hid_report_gap_seconds(self.settings_path) * 1000),
            ),
            config=ConfigSettings(path=str(config.config_file_path(self.settings_path))),
        )

    async def update_settings(self, update: AppSettingsUpdate) -> AppSettings:
        path = config.config_file_path(self.settings_path)
        patch = update.model_dump(exclude_unset=True, exclude_none=False)
        if not patch:
            return await self.get_settings()

        current = self._read_raw_config(path)
        merged = _deep_update(current, patch)

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.safe_dump(merged, sort_keys=False), encoding="utf-8")
        config.reset_config_cache_for_tests()
        return await self.get_settings()

    def _read_raw_config(self, path: Path) -> dict[str, Any]:
        if not path.exists():
            return {}
        raw_config = yaml.safe_load(path.read_text(encoding="utf-8"))
        if raw_config is None:
            return {}
        if not isinstance(raw_config, dict):
            raise ValueError("PixyPilot config must be a YAML mapping")
        return _string_keys(raw_config)


def get_settings_service() -> SettingsService:
    return SettingsService()


def _deep_update(current: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    merged = dict(current)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_update(merged[key], value)
        else:
            merged[key] = value
    return merged


def _string_keys(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _string_keys(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_string_keys(item) for item in value]
    return value
