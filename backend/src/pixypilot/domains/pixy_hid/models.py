from typing import Literal

from pydantic import BaseModel, Field

TrackingMode = Literal["off", "tracking", "privacy"]
TargetTrackingMode = Literal["off", "face", "half_body", "full_body"]
AudioMode = Literal["noise_cancel", "live", "original"]
PtzDirection = Literal["left", "right", "up", "down"]
FocusMeteringMode = Literal["center", "human_face", "selected_area"]
PixyHidQueryName = Literal[
    "tracking_state",
    "target_tracking_state",
    "tracking_capability",
    "tracking_probe_0100",
    "tracking_probe_0102",
    "tracking_probe_0103",
    "tracking_probe_0104",
    "device_info",
    "audio_state",
    "gesture_state",
    "auto_privacy_state",
    "focus_metering_state",
    "mirror_horizontal_state",
    "mirror_vertical_state",
    "auto_rotate_state",
]


class PixyHidStatus(BaseModel):
    available: bool
    path: str | None = None
    readable: bool = False
    writable: bool = False
    reason: str | None = None
    known_controls: list[str] = []


class PixyHidRawQueryResult(BaseModel):
    name: PixyHidQueryName
    request_hex: str
    response_hex: str | None = None
    value_index: int | None = None
    raw_value: int | None = None
    raw_bits: list[int] = Field(default_factory=list)
    ascii_value: str | None = None
    ascii_preview: str | None = None
    path: str


class PixyHidDeviceState(BaseModel):
    tracking_mode: TrackingMode | None = None
    tracking_raw_value: int | None = None
    tracking_raw_bits: list[int] = Field(default_factory=list)
    target_tracking_mode: TargetTrackingMode | None = None
    target_tracking_raw_value: int | None = None
    target_tracking_x: float | None = None
    target_tracking_y: float | None = None
    target_tracking_scale: float | None = None
    audio_mode: AudioMode | None = None
    audio_raw_value: int | None = None
    gesture_enabled: bool | None = None
    gesture_raw_value: int | None = None
    queries: dict[PixyHidQueryName, PixyHidRawQueryResult] = Field(default_factory=dict)
    path: str


class PixyHidDiagnosticSnapshot(BaseModel):
    captured_at: str
    path: str
    queries: list[PixyHidRawQueryResult]
    file_path: str | None = None


class PixyHidCommandResult(BaseModel):
    ok: bool
    command: str
    value: str | int | bool | float
    path: str


class TrackingModeRequest(BaseModel):
    mode: TrackingMode


class TargetTrackingRequest(BaseModel):
    mode: TargetTrackingMode
    x: float = Field(default=0.5, ge=0.0, le=1.0)
    y: float = Field(default=0.5, ge=0.0, le=1.0)
    scale: float = Field(default=1.0, ge=0.0, le=4.0)


class GestureRequest(BaseModel):
    enabled: bool


class MirrorRequest(BaseModel):
    horizontal: bool
    vertical: bool


class AudioModeRequest(BaseModel):
    mode: AudioMode


class AutoPrivacyRequest(BaseModel):
    timeout_seconds: int = Field(ge=0, le=0xFFFFFFFF)


class PtzDirectionRequest(BaseModel):
    direction: PtzDirection


class PtzVectorRequest(BaseModel):
    x: float = Field(ge=-30.0, le=30.0)
    y: float = Field(ge=-30.0, le=30.0)
    z: float = Field(default=0.0, ge=-30.0, le=30.0)


class PtzRelativeRequest(BaseModel):
    direction: PtzDirection
    degrees: float = Field(default=3.0, gt=0.0, le=30.0)


class PtzAbsoluteRequest(BaseModel):
    pan: float = Field(ge=-90.0, le=90.0)
    tilt: float = Field(ge=-90.0, le=90.0)


class PtzPresetSlotRequest(BaseModel):
    slot: int = Field(ge=1, le=3)


class FocusMeteringRequest(BaseModel):
    mode: FocusMeteringMode
    x: int | None = Field(default=None, ge=0, le=0x7F)
    y: int | None = Field(default=None, ge=0, le=0x7F)
