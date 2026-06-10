from pathlib import Path

import pixypilot.domains.video.service as video_service_module
from pixypilot.domains.video.models import VideoStreamSettings
from pixypilot.domains.video.service import VideoService, build_input_args, build_record_command, build_stream_command


class FakeProcess:
    def __init__(self) -> None:
        self.returncode = None
        self.terminated = False
        self.killed = False

    def terminate(self) -> None:
        self.terminated = True

    def kill(self) -> None:
        self.killed = True

    async def wait(self) -> None:
        self.returncode = 0


class FakeNativeCapture:
    opened = False
    closed = False
    frames: list[bytes | Exception] = [b"\xff\xd8native-frame\xff\xd9"]

    def __init__(self, device_path: str, settings: VideoStreamSettings) -> None:
        self.device_path = device_path
        self.settings = settings
        self.frames = list(FakeNativeCapture.frames)

    def open(self) -> None:
        FakeNativeCapture.opened = True

    def read_frame(self) -> bytes:
        if not self.frames:
            raise RuntimeError("done")
        frame = self.frames.pop(0)
        if isinstance(frame, Exception):
            raise frame
        return frame

    def close(self) -> None:
        FakeNativeCapture.closed = True


async def immediate_to_thread(func, /, *args, **kwargs):
    return func(*args, **kwargs)


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


async def test_mjpg_preview_uses_native_capture(monkeypatch, tmp_path) -> None:
    FakeNativeCapture.opened = False
    FakeNativeCapture.closed = False
    FakeNativeCapture.frames = [b"\xff\xd8native-frame\xff\xd9"]
    monkeypatch.setattr(video_service_module, "NativeMjpegCapture", FakeNativeCapture)
    monkeypatch.setattr(video_service_module.asyncio, "to_thread", immediate_to_thread)
    service = VideoService(tmp_path)

    chunks = [
        chunk
        async for chunk in service.mjpeg_stream(
            "/dev/video0",
            VideoStreamSettings(pixel_format="MJPG", width=1280, height=720, fps=30),
        )
    ]

    assert FakeNativeCapture.opened is True
    assert FakeNativeCapture.closed is True
    assert chunks == [b"--frame\r\nContent-Type: image/jpeg\r\nCache-Control: no-store\r\n\r\n\xff\xd8native-frame\xff\xd9\r\n"]


async def test_mjpg_preview_keeps_native_capture_alive_after_frame_timeout(monkeypatch, tmp_path) -> None:
    FakeNativeCapture.opened = False
    FakeNativeCapture.closed = False
    FakeNativeCapture.frames = [TimeoutError("no frame yet"), b"\xff\xd8native-frame\xff\xd9"]
    monkeypatch.setattr(video_service_module, "NativeMjpegCapture", FakeNativeCapture)
    monkeypatch.setattr(video_service_module.asyncio, "to_thread", immediate_to_thread)
    service = VideoService(tmp_path)

    chunks = [
        chunk
        async for chunk in service.mjpeg_stream(
            "/dev/video0",
            VideoStreamSettings(pixel_format="MJPG", width=1280, height=720, fps=30),
        )
    ]

    assert FakeNativeCapture.opened is True
    assert FakeNativeCapture.closed is True
    assert chunks == [b"--frame\r\nContent-Type: image/jpeg\r\nCache-Control: no-store\r\n\r\n\xff\xd8native-frame\xff\xd9\r\n"]


def test_record_command_writes_matroska_file_without_reencoding() -> None:
    command = build_record_command(
        "/dev/video0",
        VideoStreamSettings(pixel_format="MJPG", width=1280, height=720, fps=60),
        Path("/tmp/pixypilot-test.mkv"),
    )

    assert command[-6:] == ["-an", "-c:v", "copy", "-f", "matroska", "/tmp/pixypilot-test.mkv"]
    assert command[-1] == "/tmp/pixypilot-test.mkv"


async def test_stop_streams_terminates_registered_preview_processes(tmp_path) -> None:
    service = VideoService(tmp_path)
    process = FakeProcess()

    service._stream_processes["/dev/video0"] = [process]  # noqa: SLF001 - verifies stream ownership cleanup.
    await service.stop_streams("/dev/video0")

    assert process.terminated is True
    assert service._stream_processes == {}  # noqa: SLF001 - internal registry should be cleared.


async def test_stop_streams_closes_native_preview_captures(monkeypatch, tmp_path) -> None:
    FakeNativeCapture.closed = False
    monkeypatch.setattr(video_service_module.asyncio, "to_thread", immediate_to_thread)
    service = VideoService(tmp_path)
    capture = FakeNativeCapture("/dev/video0", VideoStreamSettings(pixel_format="MJPG", width=1280, height=720, fps=30))

    service._native_streams["/dev/video0"] = capture  # noqa: SLF001 - verifies native registry cleanup.
    await service.stop_streams("/dev/video0")

    assert FakeNativeCapture.closed is True
    assert service._native_streams == {}  # noqa: SLF001 - internal registry should be cleared.
