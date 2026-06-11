import struct
from fractions import Fraction

import pytest

from pixypilot.domains.v4l2.native import (
    VIDIOC_G_FMT,
    VIDIOC_G_PARM,
    VIDIOC_S_FMT,
    VIDIOC_S_PARM,
    VIDIOC_QUERYCTRL,
    VIDIOC_QUERYMENU,
    V4L2_BUF_TYPE_VIDEO_CAPTURE,
    V4L2_FORMAT_SIZE,
    V4L2_QUERYCTRL_SIZE,
    V4L2_QUERYMENU_SIZE,
    V4L2_STREAMPARM_SIZE,
    build_format_buffer,
    build_streamparm_buffer,
    fourcc,
)


def test_query_control_ioctl_numbers_match_linux_header_sizes() -> None:
    assert V4L2_QUERYCTRL_SIZE == 68
    assert V4L2_QUERYMENU_SIZE == 44
    assert VIDIOC_QUERYCTRL == 0xC0445624
    assert VIDIOC_QUERYMENU == 0xC02C5625
    assert V4L2_FORMAT_SIZE == 208
    assert VIDIOC_G_FMT == 0xC0D05604
    assert VIDIOC_S_FMT == 0xC0D05605
    assert VIDIOC_G_PARM == 0xC0CC5615
    assert VIDIOC_S_PARM == 0xC0CC5616


def test_fourcc_encodes_v4l2_pixel_format() -> None:
    assert fourcc("MJPG") == 0x47504A4D
    assert fourcc("YUYV") == 0x56595559


def test_fourcc_rejects_non_four_character_values() -> None:
    with pytest.raises(ValueError, match="four-character"):
        fourcc("RGB")


def test_format_buffer_sets_capture_type_size_and_fourcc() -> None:
    buffer = build_format_buffer("MJPG", 1920, 1080)

    assert len(buffer) == V4L2_FORMAT_SIZE
    assert struct.unpack_from("=I", buffer, 0)[0] == V4L2_BUF_TYPE_VIDEO_CAPTURE
    width, height, pixel_format = struct.unpack_from("=III", buffer, 4)
    assert (width, height, pixel_format) == (1920, 1080, fourcc("MJPG"))


def test_streamparm_buffer_encodes_timeperframe() -> None:
    buffer = build_streamparm_buffer(30)

    assert len(buffer) == V4L2_STREAMPARM_SIZE
    assert struct.unpack_from("=I", buffer, 0)[0] == V4L2_BUF_TYPE_VIDEO_CAPTURE
    numerator, denominator = struct.unpack_from("=II", buffer, 12)
    assert (numerator, denominator) == (1, 30)


def test_streamparm_buffer_preserves_uvc_frame_interval() -> None:
    buffer = build_streamparm_buffer(60, frame_interval_100ns=166666)

    numerator, denominator = struct.unpack_from("=II", buffer, 12)
    assert Fraction(numerator, denominator) == Fraction(166666, 10_000_000)
