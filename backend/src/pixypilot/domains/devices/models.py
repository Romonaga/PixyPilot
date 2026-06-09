from pydantic import BaseModel


class Device(BaseModel):
    path: str
    name: str
    driver: str | None = None
    bus_info: str | None = None
    is_capture: bool = False
