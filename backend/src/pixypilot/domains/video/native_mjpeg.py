import errno
import fcntl
import mmap
import os
import select
import struct
import threading

from pixypilot.domains.v4l2.native import (
    VIDIOC_S_FMT,
    VIDIOC_S_PARM,
    V4L2_BUF_TYPE_VIDEO_CAPTURE,
    build_format_buffer,
    build_streamparm_buffer,
)
from pixypilot.domains.video.models import VideoStreamSettings

VIDIOC_REQBUFS = 0xC0145608
VIDIOC_QUERYBUF = 0xC0585609
VIDIOC_QBUF = 0xC058560F
VIDIOC_DQBUF = 0xC0585611
VIDIOC_STREAMON = 0x40045612
VIDIOC_STREAMOFF = 0x40045613

V4L2_MEMORY_MMAP = 1
V4L2_REQUESTBUFFERS_SIZE = 20
V4L2_BUFFER_SIZE = 88
V4L2_BUFFER_OFFSET_INDEX = 0
V4L2_BUFFER_OFFSET_TYPE = 4
V4L2_BUFFER_OFFSET_BYTESUSED = 8
V4L2_BUFFER_OFFSET_MEMORY = 60
V4L2_BUFFER_OFFSET_M = 64
V4L2_BUFFER_OFFSET_LENGTH = 72


class NativeMjpegCapture:
    def __init__(self, device_path: str, settings: VideoStreamSettings, buffer_count: int = 4) -> None:
        if settings.pixel_format.upper() != "MJPG":
            raise ValueError("Native MJPEG capture only supports MJPG streams")
        self.device_path = device_path
        self.settings = settings
        self.buffer_count = buffer_count
        self.fd: int | None = None
        self.buffers: list[mmap.mmap] = []
        self.streaming = False
        self.closed = False
        self._lock = threading.RLock()

    def open(self) -> None:
        self.fd = os.open(self.device_path, os.O_RDWR | getattr(os, "O_CLOEXEC", 0) | os.O_NONBLOCK)
        self.closed = False
        try:
            fcntl.ioctl(
                self.fd,
                VIDIOC_S_FMT,
                build_format_buffer(self.settings.pixel_format, self.settings.width, self.settings.height),
            )
            fcntl.ioctl(
                self.fd,
                VIDIOC_S_PARM,
                build_streamparm_buffer(self.settings.fps, self.settings.frame_interval_100ns),
            )
            self._request_buffers(self.buffer_count)
            self._map_and_queue_buffers()
            fcntl.ioctl(self.fd, VIDIOC_STREAMON, struct.pack("=I", V4L2_BUF_TYPE_VIDEO_CAPTURE))
            self.streaming = True
        except Exception:
            self.close()
            raise

    def read_frame(self, timeout: float = 0.5) -> bytes:
        with self._lock:
            if self.fd is None or self.closed:
                raise RuntimeError("Native MJPEG capture is not open")

            ready, _, _ = select.select([self.fd], [], [], timeout)
            if not ready:
                raise TimeoutError("Timed out waiting for V4L2 frame")

            buffer = _build_buffer()
            try:
                fcntl.ioctl(self.fd, VIDIOC_DQBUF, buffer, True)
            except BlockingIOError as exc:
                raise TimeoutError("Timed out waiting for V4L2 frame") from exc
            except OSError as exc:
                if exc.errno == errno.EAGAIN:
                    raise TimeoutError("Timed out waiting for V4L2 frame") from exc
                raise

            index = struct.unpack_from("=I", buffer, V4L2_BUFFER_OFFSET_INDEX)[0]
            bytes_used = struct.unpack_from("=I", buffer, V4L2_BUFFER_OFFSET_BYTESUSED)[0]
            try:
                return bytes(self.buffers[index][:bytes_used])
            finally:
                if self.fd is not None and not self.closed:
                    fcntl.ioctl(self.fd, VIDIOC_QBUF, buffer)

    def close(self) -> None:
        with self._lock:
            self.closed = True
            fd = self.fd
            self.fd = None
            if fd is not None and self.streaming:
                try:
                    fcntl.ioctl(fd, VIDIOC_STREAMOFF, struct.pack("=I", V4L2_BUF_TYPE_VIDEO_CAPTURE))
                except OSError:
                    pass
                self.streaming = False

            for mapped in self.buffers:
                try:
                    mapped.close()
                except BufferError:
                    pass
            self.buffers = []

            if fd is not None:
                try:
                    self._release_buffers(fd)
                finally:
                    os.close(fd)

    def _request_buffers(self, count: int) -> None:
        if self.fd is None:
            raise RuntimeError("Native MJPEG capture is not open")
        payload = bytearray(V4L2_REQUESTBUFFERS_SIZE)
        struct.pack_into("=III", payload, 0, count, V4L2_BUF_TYPE_VIDEO_CAPTURE, V4L2_MEMORY_MMAP)
        fcntl.ioctl(self.fd, VIDIOC_REQBUFS, payload, True)
        actual_count = struct.unpack_from("=I", payload, 0)[0]
        if actual_count < 2:
            raise RuntimeError(f"V4L2 device only provided {actual_count} streaming buffer(s)")
        self.buffer_count = actual_count

    def _map_and_queue_buffers(self) -> None:
        if self.fd is None:
            raise RuntimeError("Native MJPEG capture is not open")
        for index in range(self.buffer_count):
            buffer = _build_buffer(index)
            fcntl.ioctl(self.fd, VIDIOC_QUERYBUF, buffer, True)
            length = struct.unpack_from("=I", buffer, V4L2_BUFFER_OFFSET_LENGTH)[0]
            offset = struct.unpack_from("=I", buffer, V4L2_BUFFER_OFFSET_M)[0]
            mapped = mmap.mmap(
                self.fd,
                length,
                flags=mmap.MAP_SHARED,
                prot=mmap.PROT_READ | mmap.PROT_WRITE,
                offset=offset,
            )
            self.buffers.append(mapped)
            fcntl.ioctl(self.fd, VIDIOC_QBUF, buffer)

    def _release_buffers(self, fd: int) -> None:
        payload = bytearray(V4L2_REQUESTBUFFERS_SIZE)
        struct.pack_into("=III", payload, 0, 0, V4L2_BUF_TYPE_VIDEO_CAPTURE, V4L2_MEMORY_MMAP)
        try:
            fcntl.ioctl(fd, VIDIOC_REQBUFS, payload, True)
        except OSError:
            pass


def _build_buffer(index: int = 0) -> bytearray:
    buffer = bytearray(V4L2_BUFFER_SIZE)
    struct.pack_into("=I", buffer, V4L2_BUFFER_OFFSET_INDEX, index)
    struct.pack_into("=I", buffer, V4L2_BUFFER_OFFSET_TYPE, V4L2_BUF_TYPE_VIDEO_CAPTURE)
    struct.pack_into("=I", buffer, V4L2_BUFFER_OFFSET_MEMORY, V4L2_MEMORY_MMAP)
    return buffer
