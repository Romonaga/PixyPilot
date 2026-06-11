from pydantic import BaseModel, Field


class UvcExtensionValue(BaseModel):
    query: str
    ok: bool
    size: int | None = None
    hex_value: str | None = None
    int_value: int | None = None
    ascii_preview: str | None = None
    error: str | None = None


class UvcExtensionSelectorProbe(BaseModel):
    unit_id: int
    selector: int
    length: int | None = None
    info: int | None = None
    info_flags: list[str] = Field(default_factory=list)
    supports_get: bool = False
    supports_set: bool = False
    current: UvcExtensionValue | None = None
    minimum: UvcExtensionValue | None = None
    maximum: UvcExtensionValue | None = None
    resolution: UvcExtensionValue | None = None
    default: UvcExtensionValue | None = None
    changed_since_previous: bool = False
    changed_fields: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class UvcExtensionSnapshot(BaseModel):
    captured_at: str
    device_path: str
    unit_id: int
    selectors: list[UvcExtensionSelectorProbe]
    previous_file_path: str | None = None
    changed_selectors: list[int] = Field(default_factory=list)
    file_path: str | None = None
