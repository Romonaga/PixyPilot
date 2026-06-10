from pathlib import Path

from pixypilot import config
from pixypilot.domains.settings.models import (
    AppSettings,
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


def get_settings_service() -> SettingsService:
    return SettingsService()
