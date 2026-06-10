from typing import Literal

from pydantic import BaseModel, Field

TrackingMode = Literal["off", "tracking", "privacy"]
AudioMode = Literal["noise_cancel", "live", "original"]


class PixyHidStatus(BaseModel):
    available: bool
    path: str | None = None
    readable: bool = False
    writable: bool = False
    reason: str | None = None
    known_controls: list[str] = []


class PixyHidCommandResult(BaseModel):
    ok: bool
    command: str
    value: str | int | bool
    path: str


class TrackingModeRequest(BaseModel):
    mode: TrackingMode


class GestureRequest(BaseModel):
    enabled: bool


class MirrorRequest(BaseModel):
    horizontal: bool
    vertical: bool


class AudioModeRequest(BaseModel):
    mode: AudioMode


class AutoPrivacyRequest(BaseModel):
    timeout_seconds: int = Field(ge=0, le=0xFFFFFFFF)
