import pytest

from pixypilot.domains.v4l2.models import MenuOption, V4L2Control
from pixypilot.domains.v4l2.service import V4L2Service, _device_caps_include_video_capture


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


def test_device_caps_use_device_specific_capture_block() -> None:
    metadata_only = """
Capabilities     : 0x84a00001
\tVideo Capture
\tMetadata Capture
Device Caps      : 0x04a00000
\tMetadata Capture
\tStreaming
Media Driver Info:
"""
    capture = """
Capabilities     : 0x84a00001
\tVideo Capture
\tMetadata Capture
Device Caps      : 0x04200001
\tVideo Capture
\tStreaming
Media Driver Info:
"""

    assert _device_caps_include_video_capture(capture)
    assert not _device_caps_include_video_capture(metadata_only)
