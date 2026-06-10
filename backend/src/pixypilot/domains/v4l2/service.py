from pathlib import Path

from pixypilot.core.commands import AsyncCommandRunner, CommandError
from pixypilot.domains.devices.models import Device
from pixypilot.domains.v4l2.models import V4L2Control, VideoFormatOption
from pixypilot.domains.v4l2.native import NativeControlWriter, control_with_value
from pixypilot.domains.v4l2.parser import parse_controls, parse_video_formats


class V4L2Service:
    def __init__(
        self,
        runner: AsyncCommandRunner | None = None,
        control_writer: NativeControlWriter | None = None,
    ) -> None:
        self.runner = runner or AsyncCommandRunner()
        self.control_writer = control_writer or NativeControlWriter()

    def device_path_from_name(self, device_name: str) -> str:
        if not device_name.startswith("video") or "/" in device_name:
            raise ValueError("Device must be addressed as videoN")
        return f"/dev/{device_name}"

    async def list_devices(self) -> list[Device]:
        paths = sorted(Path("/dev").glob("video*"))
        devices: list[Device] = []
        for path in paths:
            try:
                devices.append(await self._inspect_device(str(path)))
            except CommandError:
                devices.append(Device(path=str(path), name=path.name))
        return devices

    async def _inspect_device(self, path: str) -> Device:
        result = await self.runner.run(["v4l2-ctl", "-d", path, "--info"])
        fields = _parse_info_fields(result.stdout)
        caps = result.stdout
        return Device(
            path=path,
            name=fields.get("Card type") or Path(path).name,
            driver=fields.get("Driver name"),
            bus_info=fields.get("Bus info"),
            is_capture=_device_caps_include_video_capture(caps),
        )

    async def list_controls(self, device_path: str) -> list[V4L2Control]:
        self._validate_device_path(device_path)
        result = await self.runner.run(["v4l2-ctl", "-d", device_path, "--list-ctrls-menu"])
        return parse_controls(result.stdout)

    async def list_formats(self, device_path: str) -> list[VideoFormatOption]:
        self._validate_device_path(device_path)
        result = await self.runner.run(["v4l2-ctl", "-d", device_path, "--list-formats-ext"])
        return parse_video_formats(result.stdout)

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

        await self.runner.run(
            [
                "v4l2-ctl",
                "-d",
                device_path,
                f"--set-fmt-video=width={width},height={height},pixelformat={pixel_format}",
            ]
        )
        await self.runner.run(["v4l2-ctl", "-d", device_path, f"--set-parm={_format_fps_for_v4l2(fps)}"])
        return selected

    async def set_control(self, device_path: str, control_name: str, value: int) -> V4L2Control:
        self._validate_device_path(device_path)
        controls = await self.list_controls(device_path)
        control = next((item for item in controls if item.name == control_name), None)
        if control is None:
            raise ValueError(f"Unknown control: {control_name}")
        self._validate_control_value(control, value)
        await self.control_writer.set_control(device_path, control.control_id, value)
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


def _parse_info_fields(output: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in output.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            fields[key] = value
    return fields


def _device_caps_include_video_capture(output: str) -> bool:
    lines = output.splitlines()
    in_device_caps = False
    device_caps_lines: list[str] = []

    for line in lines:
        if line.strip().startswith("Device Caps"):
            in_device_caps = True
            continue
        if in_device_caps and line and not line.startswith("\t"):
            break
        if in_device_caps:
            device_caps_lines.append(line.strip())

    return "Video Capture" in device_caps_lines


def _format_fps_for_v4l2(fps: float) -> str:
    rounded = round(fps)
    if abs(fps - rounded) < 0.001:
        return str(rounded)
    return f"{fps:.3f}".rstrip("0").rstrip(".")


def get_v4l2_service() -> V4L2Service:
    return V4L2Service()
