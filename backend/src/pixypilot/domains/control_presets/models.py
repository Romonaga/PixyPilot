from typing import Literal

from pydantic import BaseModel, Field, field_validator


ControlPresetScope = Literal["image", "focus", "exposure"]


class ControlPreset(BaseModel):
    id: str
    name: str
    scope: ControlPresetScope
    values: dict[str, int]
    created_at: str


class ControlPresetCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=48)
    scope: ControlPresetScope
    values: dict[str, int] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise ValueError("Preset name is required")
        return cleaned


class ControlPresetDeleteResult(BaseModel):
    ok: bool
    id: str


class ControlPresetStore(BaseModel):
    presets: list[ControlPreset] = Field(default_factory=list)
