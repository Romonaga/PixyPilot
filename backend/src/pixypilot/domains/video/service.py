import asyncio
import os
import subprocess
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

from pixypilot.domains.video.models import VideoRecordingStatus, VideoStreamSettings

PIXEL_FORMAT_INPUTS = {
    "MJPG": "mjpeg",
    "YUYV": "yuyv422",
    "NV12": "nv12",
}
FRAME_BOUNDARY = b"--frame\r\nContent-Type: image/jpeg\r\nCache-Control: no-store\r\n\r\n"


class VideoService:
    def __init__(self, recordings_dir: Path | None = None) -> None:
        self.recordings_dir = recordings_dir or _recordings_dir()
        self._recording_process: asyncio.subprocess.Process | None = None
        self._recording_status = VideoRecordingStatus(recording=False)

    async def mjpeg_stream(self, device_path: str, settings: VideoStreamSettings) -> AsyncIterator[bytes]:
        command = build_stream_command(device_path, settings)
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        if process.stdout is None:
            return

        try:
            async for frame in _jpeg_frames(process.stdout):
                yield FRAME_BOUNDARY + frame + b"\r\n"
        finally:
            await _stop_process(process)

    async def start_recording(
        self,
        device_name: str,
        device_path: str,
        settings: VideoStreamSettings,
    ) -> VideoRecordingStatus:
        await self._reap_finished_recording()
        if self._recording_process is not None:
            raise ValueError("A recording is already running")

        self.recordings_dir.mkdir(parents=True, exist_ok=True)
        started_at = datetime.now(UTC)
        output_path = self.recordings_dir / f"pixypilot-{device_name}-{started_at.strftime('%Y%m%d-%H%M%S')}.mkv"
        command = build_record_command(device_path, settings, output_path)
        self._recording_process = await asyncio.create_subprocess_exec(
            *command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self._recording_status = VideoRecordingStatus(
            recording=True,
            device_name=device_name,
            path=str(output_path),
            started_at=started_at.isoformat(),
        )
        return self._recording_status

    async def stop_recording(self) -> VideoRecordingStatus:
        if self._recording_process is None:
            self._recording_status = VideoRecordingStatus(recording=False, reason="No recording is running")
            return self._recording_status

        await _stop_process(self._recording_process)
        finished = self._recording_status.model_copy(update={"recording": False})
        self._recording_process = None
        self._recording_status = finished
        return finished

    async def recording_status(self) -> VideoRecordingStatus:
        await self._reap_finished_recording()
        return self._recording_status

    async def _reap_finished_recording(self) -> None:
        if self._recording_process is None:
            return
        if self._recording_process.returncode is None:
            return
        await self._recording_process.wait()
        self._recording_process = None
        self._recording_status = self._recording_status.model_copy(
            update={"recording": False, "reason": "Recording process exited"}
        )


def build_stream_command(device_path: str, settings: VideoStreamSettings) -> list[str]:
    if settings.pixel_format.upper() == "MJPG":
        return [
            *build_input_args(device_path, settings),
            "-an",
            "-c:v",
            "copy",
            "-f",
            "mjpeg",
            "pipe:1",
        ]

    return [
        *build_input_args(device_path, settings),
        "-an",
        "-f",
        "mjpeg",
        "-q:v",
        "5",
        "pipe:1",
    ]


def build_record_command(device_path: str, settings: VideoStreamSettings, output_path: Path) -> list[str]:
    return [
        *build_input_args(device_path, settings),
        "-an",
        "-c:v",
        "copy",
        "-f",
        "matroska",
        str(output_path),
    ]


def build_input_args(device_path: str, settings: VideoStreamSettings) -> list[str]:
    return [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "v4l2",
        "-framerate",
        _format_fps(settings.fps),
        "-video_size",
        f"{settings.width}x{settings.height}",
        "-input_format",
        _ffmpeg_pixel_format(settings.pixel_format),
        "-i",
        device_path,
    ]


def _ffmpeg_pixel_format(pixel_format: str) -> str:
    return PIXEL_FORMAT_INPUTS.get(pixel_format.upper(), pixel_format.lower())


def _format_fps(fps: float) -> str:
    rounded = round(fps)
    if abs(fps - rounded) < 0.001:
        return str(rounded)
    return f"{fps:.3f}".rstrip("0").rstrip(".")


async def _jpeg_frames(stdout: asyncio.StreamReader) -> AsyncIterator[bytes]:
    buffer = b""
    while True:
        chunk = await stdout.read(65536)
        if not chunk:
            break
        buffer += chunk
        while True:
            start = buffer.find(b"\xff\xd8")
            end = buffer.find(b"\xff\xd9", start + 2 if start >= 0 else 0)
            if start < 0:
                buffer = buffer[-1:]
                break
            if end < 0:
                buffer = buffer[start:]
                break
            frame = buffer[start : end + 2]
            buffer = buffer[end + 2 :]
            yield frame


async def _stop_process(process: asyncio.subprocess.Process) -> None:
    if process.returncode is not None:
        await process.wait()
        return
    process.terminate()
    try:
        await asyncio.wait_for(process.wait(), timeout=3)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()


def _recordings_dir() -> Path:
    configured = os.environ.get("PIXYPILOT_RECORDINGS_DIR")
    return Path(configured) if configured else Path.cwd() / "recordings"


_video_service = VideoService()


def get_video_service() -> VideoService:
    return _video_service
