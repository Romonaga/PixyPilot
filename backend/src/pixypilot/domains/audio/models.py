from pydantic import BaseModel


class AudioStatus(BaseModel):
    available: bool
    card: int | None = None
    name: str | None = None
    muted: bool | None = None
    volume: int | None = None
    reason: str | None = None


class AudioMuteRequest(BaseModel):
    muted: bool


class AudioCommandResult(BaseModel):
    ok: bool
    command: str
    value: bool
    card: int
