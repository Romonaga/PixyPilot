import pytest

from pixypilot.domains.v4l2.models import MenuOption, V4L2Control, VideoFormatOption
from pixypilot.domains.v4l2.service import V4L2Service


class FakeControlWriter:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, int]] = []

    async def set_control(self, device_path: str, control_id: str, value: int) -> None:
        self.calls.append((device_path, control_id, value))


class FakeFormatWriter:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, int, int, float, int | None]] = []

    async def set_format(
        self,
        device_path: str,
        pixel_format: str,
        width: int,
        height: int,
        fps: float,
        frame_interval_100ns: int | None = None,
    ) -> VideoFormatOption:
        self.calls.append((device_path, pixel_format, width, height, fps, frame_interval_100ns))
        accepted_fps = 10_000_000 / frame_interval_100ns if frame_interval_100ns else fps
        return VideoFormatOption(
            pixel_format=pixel_format,
            description="Current device format",
            width=width,
            height=height,
            fps=accepted_fps,
            frame_interval_100ns=frame_interval_100ns,
            label=f"{pixel_format} {width}x{height} {accepted_fps:g}fps",
        )


class StaticControlService(V4L2Service):
    def __init__(
        self,
        controls: list[V4L2Control],
        writer: FakeControlWriter,
        formats: list[VideoFormatOption] | None = None,
        format_writer: FakeFormatWriter | None = None,
    ) -> None:
        super().__init__(control_writer=writer, format_writer=format_writer)
        self.static_controls = controls
        self.static_formats = formats or []

    async def list_controls(self, device_path: str) -> list[V4L2Control]:
        return self.static_controls

    async def list_formats(self, device_path: str) -> list[VideoFormatOption]:
        return self.static_formats


class DynamicControlService(StaticControlService):
    async def list_controls(self, device_path: str) -> list[V4L2Control]:
        if self.control_writer.calls:
            return [
                control.model_copy(update={"value": 0}) if control.name == "focus_automatic_continuous" else control
                for control in self.static_controls
            ]
        return self.static_controls


def make_control(**overrides: object) -> V4L2Control:
    data = {
        "name": "brightness",
        "label": "Brightness",
        "control_id": "0x1",
        "group": "User Controls",
        "kind": "int",
        "value": 10,
        "min": 0,
        "max": 100,
        "step": 5,
    }
    data.update(overrides)
    return V4L2Control(**data)


def test_rejects_non_video_device_path() -> None:
    service = V4L2Service()

    with pytest.raises(ValueError, match="Only /dev/videoN"):
        service._validate_device_path("/dev/hidraw14")


def test_rejects_value_outside_range() -> None:
    service = V4L2Service()

    with pytest.raises(ValueError, match="<= 100"):
        service._validate_control_value(make_control(), 105)


def test_rejects_value_not_aligned_to_step() -> None:
    service = V4L2Service()

    with pytest.raises(ValueError, match="step 5"):
        service._validate_control_value(make_control(), 12)


def test_allows_valid_menu_value() -> None:
    service = V4L2Service()
    control = make_control(
        kind="menu",
        menu=[MenuOption(value=1, label="Manual"), MenuOption(value=3, label="Auto")],
    )

    service._validate_control_value(control, 3)


def test_rejects_inactive_control() -> None:
    service = V4L2Service()

    with pytest.raises(ValueError, match="inactive"):
        service._validate_control_value(make_control(flags=["inactive"]), 10)


async def test_set_control_uses_native_writer_and_returns_updated_value() -> None:
    writer = FakeControlWriter()
    service = StaticControlService(
        [make_control(name="zoom_absolute", control_id="0x009a090d", value=100, min=100, max=150, step=1)],
        writer,
    )

    updated = await service.set_control("/dev/video0", "zoom_absolute", 120)

    assert writer.calls == [("/dev/video0", "0x009a090d", 120)]
    assert updated.value == 120


async def test_set_control_updates_menu_value_label_without_refreshing_controls() -> None:
    writer = FakeControlWriter()
    control = make_control(
        name="power_line_frequency",
        control_id="0x00980918",
        kind="menu",
        value=2,
        menu=[MenuOption(value=1, label="50 Hz"), MenuOption(value=2, label="60 Hz")],
    )
    service = StaticControlService([control], writer)

    updated = await service.set_control("/dev/video0", "power_line_frequency", 1)

    assert writer.calls == [("/dev/video0", "0x00980918", 1)]
    assert updated.value == 1
    assert updated.value_label == "50 Hz"


async def test_set_focus_absolute_switches_autofocus_to_manual_first() -> None:
    writer = FakeControlWriter()
    controls = [
        make_control(
            name="focus_automatic_continuous",
            control_id="0x009a090c",
            kind="bool",
            value=1,
            min=0,
            max=1,
            step=1,
        ),
        make_control(
            name="focus_absolute",
            control_id="0x009a090a",
            value=512,
            min=0,
            max=1023,
            step=1,
        ),
    ]
    service = DynamicControlService(controls, writer)

    updated = await service.set_control("/dev/video0", "focus_absolute", 300)

    assert writer.calls == [
        ("/dev/video0", "0x009a090c", 0),
        ("/dev/video0", "0x009a090a", 300),
    ]
    assert updated.value == 300


async def test_set_format_uses_native_writer_after_validating_format() -> None:
    control_writer = FakeControlWriter()
    format_writer = FakeFormatWriter()
    option = VideoFormatOption(
        pixel_format="MJPG",
        description="Motion-JPEG",
        width=1920,
        height=1080,
        fps=60.00024000096,
        frame_interval_100ns=166666,
        label="MJPG 1920x1080 60fps",
    )
    service = StaticControlService([], control_writer, formats=[option], format_writer=format_writer)

    selected = await service.set_format("/dev/video0", "MJPG", 1920, 1080, 60.00024000096, 166666)

    assert selected == option
    assert format_writer.calls == [("/dev/video0", "MJPG", 1920, 1080, 60.00024000096, 166666)]
