import struct

import pytest

from pixypilot.domains.v4l2.native import (
    V4L2_BUF_TYPE_VIDEO_CAPTURE,
    V4L2_FORMAT_SIZE,
    V4L2_STREAMPARM_SIZE,
    build_format_buffer,
    build_streamparm_buffer,
    fourcc,
)


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
