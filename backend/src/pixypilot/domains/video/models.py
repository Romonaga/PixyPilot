from pydantic import BaseModel, Field


class VideoStreamSettings(BaseModel):
    pixel_format: str = "MJPG"
    width: int = Field(default=1280, ge=1)
    height: int = Field(default=720, ge=1)
    fps: float = Field(default=30, gt=0)


class VideoRecordingRequest(VideoStreamSettings):
    pass


class VideoRecordingStatus(BaseModel):
    recording: bool
    device_name: str | None = None
    path: str | None = None
    started_at: str | None = None
    reason: str | None = None


class VideoStreamStopResult(BaseModel):
    ok: bool
    device_name: str | None = None
