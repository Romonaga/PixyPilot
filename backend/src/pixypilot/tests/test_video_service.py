from pathlib import Path

from pixypilot.domains.video.models import VideoStreamSettings
from pixypilot.domains.video.service import build_input_args, build_record_command, build_stream_command


def test_video_input_command_maps_v4l2_formats_to_ffmpeg() -> None:
    command = build_input_args(
        "/dev/video0",
        VideoStreamSettings(pixel_format="MJPG", width=1920, height=1080, fps=29.97),
    )

    assert command == [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "v4l2",
        "-framerate",
        "29.97",
        "-video_size",
        "1920x1080",
        "-input_format",
        "mjpeg",
        "-i",
        "/dev/video0",
    ]


def test_mjpg_stream_command_copies_jpeg_frames_to_stdout() -> None:
    command = build_stream_command(
        "/dev/video0",
        VideoStreamSettings(pixel_format="MJPG", width=1280, height=720, fps=30),
    )

    assert command[-6:] == ["-an", "-c:v", "copy", "-f", "mjpeg", "pipe:1"]
    assert "mjpeg" in command


def test_uncompressed_stream_command_encodes_mjpeg_to_stdout() -> None:
    command = build_stream_command(
        "/dev/video0",
        VideoStreamSettings(pixel_format="YUYV", width=640, height=480, fps=30),
    )

    assert command[-6:] == ["-an", "-f", "mjpeg", "-q:v", "5", "pipe:1"]
    assert "yuyv422" in command


def test_record_command_writes_matroska_file_without_reencoding() -> None:
    command = build_record_command(
        "/dev/video0",
        VideoStreamSettings(pixel_format="MJPG", width=1280, height=720, fps=60),
        Path("/tmp/pixypilot-test.mkv"),
    )

    assert command[-6:] == ["-an", "-c:v", "copy", "-f", "matroska", "/tmp/pixypilot-test.mkv"]
    assert command[-1] == "/tmp/pixypilot-test.mkv"
