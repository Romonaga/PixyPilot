import asyncio
import fcntl
import os
import struct

from pixypilot.domains.v4l2.models import V4L2Control


VIDIOC_S_CTRL = 0xC008561C


class NativeV4L2Error(RuntimeError):
    """Raised when a native V4L2 ioctl write fails."""


class NativeControlWriter:
    async def set_control(self, device_path: str, control_id: str, value: int) -> None:
        await asyncio.to_thread(_set_control_sync, device_path, parse_control_id(control_id), value)


def control_with_value(control: V4L2Control, value: int) -> V4L2Control:
    value_label = None
    if control.kind == "menu":
        value_label = next((option.label for option in control.menu if option.value == value), None)
    return control.model_copy(update={"value": value, "value_label": value_label})


def parse_control_id(control_id: str) -> int:
    try:
        return int(control_id, 0)
    except ValueError as exc:
        raise ValueError(f"Invalid V4L2 control id: {control_id}") from exc


def _set_control_sync(device_path: str, control_id: int, value: int) -> None:
    fd = os.open(device_path, os.O_RDWR | getattr(os, "O_CLOEXEC", 0))
    try:
        payload = struct.pack("=Ii", control_id, value)
        fcntl.ioctl(fd, VIDIOC_S_CTRL, payload)
    except OSError as exc:
        raise NativeV4L2Error(f"Unable to set V4L2 control {control_id:#x} on {device_path}: {exc}") from exc
    finally:
        os.close(fd)
