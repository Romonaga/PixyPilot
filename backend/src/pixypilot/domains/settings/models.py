from pydantic import BaseModel, Field


class SafetySettings(BaseModel):
    start_in_privacy: bool = True


class SafetySettingsUpdate(BaseModel):
    start_in_privacy: bool | None = None


class ServerSettings(BaseModel):
    host: str = "127.0.0.1"
    port: int = 8000
    reload: bool = False
    url: str = "http://127.0.0.1:8000"


class ServerSettingsUpdate(BaseModel):
    host: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    reload: bool | None = None


class FrontendSettings(BaseModel):
    dist_path: str = "frontend/dist"
    dev_server_host: str = "127.0.0.1"
    dev_server_port: int = 5173
    single_port: bool = True


class FrontendDevServerSettingsUpdate(BaseModel):
    host: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)


class FrontendSettingsUpdate(BaseModel):
    dist: str | None = None
    dev_server: FrontendDevServerSettingsUpdate | None = None


class StorageSettings(BaseModel):
    presets_path: str = "config/presets.yaml"
    recordings_dir: str = "recordings"


class StorageSettingsUpdate(BaseModel):
    presets: str | None = None
    recordings: str | None = None


class HidSettings(BaseModel):
    path: str | None = None
    report_gap_ms: int = 25


class HidSettingsUpdate(BaseModel):
    path: str | None = None
    report_gap_ms: int | None = Field(default=None, ge=0, le=1000)


class ConfigSettings(BaseModel):
    path: str = "config/pixypilot.yaml"


class AppSettings(BaseModel):
    safety: SafetySettings = Field(default_factory=SafetySettings)
    server: ServerSettings = Field(default_factory=ServerSettings)
    frontend: FrontendSettings
    storage: StorageSettings
    hid: HidSettings = Field(default_factory=HidSettings)
    config: ConfigSettings


class AppSettingsUpdate(BaseModel):
    safety: SafetySettingsUpdate | None = None
    server: ServerSettingsUpdate | None = None
    frontend: FrontendSettingsUpdate | None = None
    storage: StorageSettingsUpdate | None = None
    hid: HidSettingsUpdate | None = None
