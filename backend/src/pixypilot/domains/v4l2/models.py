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
