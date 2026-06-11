from typing import Literal

from pydantic import BaseModel


ControlKind = Literal["int", "bool", "menu", "unknown"]


class MenuOption(BaseModel):
    value: int
    label: str


class V4L2Control(BaseModel):
    name: str
    label: str
    control_id: str
    group: str
    kind: ControlKind
    value: int
    default: int | None = None
    min: int | None = None
    max: int | None = None
    step: int | None = None
    value_label: str | None = None
    flags: list[str] = []
    menu: list[MenuOption] = []

    @property
    def inactive(self) -> bool:
        return "inactive" in self.flags


class ControlSetRequest(BaseModel):
    value: int


class VideoFormatOption(BaseModel):
    pixel_format: str
    description: str
    width: int
    height: int
    fps: float
    frame_interval_100ns: int | None = None
    label: str


class VideoFormatSetRequest(BaseModel):
    pixel_format: str
    width: int
    height: int
    fps: float
    frame_interval_100ns: int | None = None
