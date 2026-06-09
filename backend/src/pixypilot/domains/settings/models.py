from pydantic import BaseModel, Field


class SafetySettings(BaseModel):
    start_in_privacy: bool = True


class AppSettings(BaseModel):
    safety: SafetySettings = Field(default_factory=SafetySettings)
