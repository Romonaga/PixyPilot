from pydantic import BaseModel


class HotplugEvent(BaseModel):
    action: str
    subsystem: str
    device_node: str | None = None
    device_type: str
