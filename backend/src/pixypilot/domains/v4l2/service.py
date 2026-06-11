from pathlib import Path

from pixypilot.domains.devices.models import Device
from pixypilot.domains.v4l2.models import V4L2Control, VideoFormatOption
from pixypilot.domains.v4l2.native import (
    NativeControlWriter,
    NativeEnumerator,
    NativeFormatWriter,
    NativeV4L2Error,
    control_with_value,
)


DEPENDENCY_CONTROLS: dict[str, tuple[str, int]] = {
    "focus_absolute": ("focus_automatic_continuous", 0),
    "white_balance_temperature": ("white_balance_automatic", 0),
    "exposure_time_absolute": ("auto_exposure", 1),
}


class V4L2Service:
    def __init__(
        self,
        enumerator: NativeEnumerator | None = None,
        control_writer: NativeControlWriter | None = None,
        format_writer: NativeFormatWriter | None = None,
    ) -> None:
        self.enumerator = enumerator or NativeEnumerator()
        self.control_writer = control_writer or NativeControlWriter()
        self.format_writer = format_writer or NativeFormatWriter()

    def device_path_from_name(self, device_name: str) -> str:
        if not device_name.startswith("video") or "/" in device_name:
            raise ValueError("Device must be addressed as videoN")
        return f"/dev/{device_name}"

    async def list_devices(self) -> list[Device]:
        paths = sorted(Path("/dev").glob("video*"))
        devices: list[Device] = []
        for path in paths:
            try:
                devices.append(await self.enumerator.inspect_device(str(path)))
            except NativeV4L2Error:
                devices.append(Device(path=str(path), name=path.name))
        return devices

    async def list_controls(self, device_path: str) -> list[V4L2Control]:
        self._validate_device_path(device_path)
        try:
            return await self.enumerator.list_controls(device_path)
        except NativeV4L2Error as exc:
            raise ValueError(str(exc)) from exc

    async def list_formats(self, device_path: str) -> list[VideoFormatOption]:
        self._validate_device_path(device_path)
        try:
            return await self.enumerator.list_formats(device_path)
        except NativeV4L2Error as exc:
            raise ValueError(str(exc)) from exc

    async def set_format(
        self,
        device_path: str,
        pixel_format: str,
        width: int,
        height: int,
        fps: float,
    ) -> VideoFormatOption:
        self._validate_device_path(device_path)
        formats = await self.list_formats(device_path)
        selected = next(
            (
                item
                for item in formats
                if item.pixel_format == pixel_format
                and item.width == width
                and item.height == height
                and abs(item.fps - fps) < 0.001
            ),
            None,
        )
        if selected is None:
            raise ValueError(f"Unsupported format: {pixel_format} {width}x{height}@{fps}")

        try:
            await self.format_writer.set_format(device_path, pixel_format, width, height, fps)
        except NativeV4L2Error as exc:
            raise ValueError(str(exc)) from exc
        return selected

    async def set_control(self, device_path: str, control_name: str, value: int) -> V4L2Control:
        self._validate_device_path(device_path)
        controls = await self.list_controls(device_path)
        control = next((item for item in controls if item.name == control_name), None)
        if control is None:
            raise ValueError(f"Unknown control: {control_name}")

        dependency = DEPENDENCY_CONTROLS.get(control_name)
        if dependency is not None:
            parent_name, parent_value = dependency
            parent = next((item for item in controls if item.name == parent_name), None)
            if parent is not None and parent.value != parent_value:
                self._validate_control_value(parent, parent_value)
                try:
                    await self.control_writer.set_control(device_path, parent.control_id, parent_value)
                except NativeV4L2Error as exc:
                    raise ValueError(str(exc)) from exc
                controls = await self.list_controls(device_path)
                control = next((item for item in controls if item.name == control_name), control)

        self._validate_control_value(control, value)
        try:
            await self.control_writer.set_control(device_path, control.control_id, value)
        except NativeV4L2Error as exc:
            raise ValueError(str(exc)) from exc
        return control_with_value(control, value)

    def _validate_device_path(self, device_path: str) -> None:
        if not device_path.startswith("/dev/video"):
            raise ValueError("Only /dev/videoN devices are allowed")
        suffix = device_path.removeprefix("/dev/video")
        if not suffix.isdigit():
            raise ValueError("Only /dev/videoN devices are allowed")

    def _validate_control_value(self, control: V4L2Control, value: int) -> None:
        if control.inactive:
            raise ValueError(f"{control.name} is inactive")
        if control.kind == "menu":
            allowed = {option.value for option in control.menu}
            if value not in allowed:
                raise ValueError(f"{control.name} must be one of {sorted(allowed)}")
            return
        if control.kind == "bool" and value not in {0, 1}:
            raise ValueError(f"{control.name} must be 0 or 1")
        if control.min is not None and value < control.min:
            raise ValueError(f"{control.name} must be >= {control.min}")
        if control.max is not None and value > control.max:
            raise ValueError(f"{control.name} must be <= {control.max}")
        if control.step and control.min is not None and (value - control.min) % control.step != 0:
            raise ValueError(f"{control.name} must align to step {control.step}")

def get_v4l2_service() -> V4L2Service:
    return V4L2Service()
