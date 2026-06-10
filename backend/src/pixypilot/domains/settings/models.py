from pydantic import BaseModel, Field


class SafetySettings(BaseModel):
    start_in_privacy: bool = True


class ServerSettings(BaseModel):
    host: str = "127.0.0.1"
    port: int = 8000
    reload: bool = False
    url: str = "http://127.0.0.1:8000"


class FrontendSettings(BaseModel):
    dist_path: str = "frontend/dist"
    dev_server_host: str = "127.0.0.1"
    dev_server_port: int = 5173
    single_port: bool = True


class StorageSettings(BaseModel):
    presets_path: str = "config/presets.yaml"
    recordings_dir: str = "recordings"


class HidSettings(BaseModel):
    path: str | None = None
    report_gap_ms: int = 25


class ConfigSettings(BaseModel):
    path: str = "config/pixypilot.yaml"


class AppSettings(BaseModel):
    safety: SafetySettings = Field(default_factory=SafetySettings)
    server: ServerSettings = Field(default_factory=ServerSettings)
    frontend: FrontendSettings
    storage: StorageSettings
    hid: HidSettings = Field(default_factory=HidSettings)
    config: ConfigSettings
