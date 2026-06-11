import asyncio
import errno
import fcntl
import os
import re
import struct
from fractions import Fraction

from pixypilot.domains.devices.models import Device
from pixypilot.domains.v4l2.models import MenuOption, VideoFormatOption
from pixypilot.domains.v4l2.models import V4L2Control


V4L2_BUF_TYPE_VIDEO_CAPTURE = 1
V4L2_FRMSIZE_TYPE_DISCRETE = 1
V4L2_FRMIVAL_TYPE_DISCRETE = 1
V4L2_CTRL_TYPE_INTEGER = 1
V4L2_CTRL_TYPE_BOOLEAN = 2
V4L2_CTRL_TYPE_MENU = 3
V4L2_CTRL_TYPE_INTEGER_MENU = 9
V4L2_CTRL_TYPE_CTRL_CLASS = 6
V4L2_CTRL_FLAG_DISABLED = 0x0001
V4L2_CTRL_FLAG_INACTIVE = 0x0010
V4L2_CTRL_FLAG_READ_ONLY = 0x0004
V4L2_CTRL_FLAG_WRITE_ONLY = 0x0040
V4L2_CTRL_FLAG_NEXT_CTRL = 0x80000000
V4L2_CTRL_CLASS_USER = 0x00980000
V4L2_CTRL_CLASS_CAMERA = 0x009A0000
V4L2_CAP_VIDEO_CAPTURE = 0x00000001
V4L2_CAP_DEVICE_CAPS = 0x80000000
VIDIOC_QUERYCAP = 0x80685600
VIDIOC_ENUM_FMT = 0xC0405602
VIDIOC_G_CTRL = 0xC008561B
VIDIOC_S_CTRL = 0xC008561C
VIDIOC_QUERYCTRL = 0xC0445624
VIDIOC_QUERYMENU = 0xC02C5625
VIDIOC_ENUM_FRAMESIZES = 0xC02C564A
VIDIOC_ENUM_FRAMEINTERVALS = 0xC034564B
VIDIOC_G_FMT = 0xC0D05604
VIDIOC_S_FMT = 0xC0D05605
VIDIOC_G_PARM = 0xC0CC5615
VIDIOC_S_PARM = 0xC0CC5616
V4L2_CAPABILITY_SIZE = 104
V4L2_FMTDESC_SIZE = 64
V4L2_QUERYCTRL_SIZE = 68
V4L2_QUERYMENU_SIZE = 44
V4L2_FRMSIZEENUM_SIZE = 44
V4L2_FRMIVALENUM_SIZE = 52
V4L2_FORMAT_SIZE = 208
V4L2_PIX_FORMAT_SIZE = 48
V4L2_STREAMPARM_SIZE = 204
V4L2_CAPTUREPARM_SIZE = 40


class NativeV4L2Error(RuntimeError):
    """Raised when a native V4L2 ioctl operation fails."""


class NativeControlWriter:
    async def set_control(self, device_path: str, control_id: str, value: int) -> None:
        await asyncio.to_thread(_set_control_sync, device_path, parse_control_id(control_id), value)


class NativeEnumerator:
    async def inspect_device(self, device_path: str) -> Device:
        return await asyncio.to_thread(_inspect_device_sync, device_path)

    async def list_controls(self, device_path: str) -> list[V4L2Control]:
        return await asyncio.to_thread(_list_controls_sync, device_path)

    async def list_formats(self, device_path: str) -> list[VideoFormatOption]:
        return await asyncio.to_thread(_list_formats_sync, device_path)


class NativeFormatWriter:
    async def set_format(
        self,
        device_path: str,
        pixel_format: str,
        width: int,
        height: int,
        fps: float,
        frame_interval_100ns: int | None = None,
    ) -> VideoFormatOption:
        return await asyncio.to_thread(
            _set_format_sync,
            device_path,
            pixel_format,
            width,
            height,
            fps,
            frame_interval_100ns,
        )


def control_with_value(control: V4L2Control, value: int) -> V4L2Control:
    value_label = None
    if control.kind == "menu":
        value_label = next((option.label for option in control.menu if option.value == value), None)
    return control.model_copy(update={"value": value, "value_label": value_label})


def parse_control_id(control_id: str) -> int:
    try:
        return int(control_id, 0)
    except ValueError as exc:
        raise ValueError(f"Invalid V4L2 control id: {control_id}") from exc


def _set_control_sync(device_path: str, control_id: int, value: int) -> None:
    fd = _open_video_device(device_path)
    try:
        payload = struct.pack("=Ii", control_id, value)
        fcntl.ioctl(fd, VIDIOC_S_CTRL, payload)
    except OSError as exc:
        raise NativeV4L2Error(f"Unable to set V4L2 control {control_id:#x} on {device_path}: {exc}") from exc
    finally:
        os.close(fd)


def _set_format_sync(
    device_path: str,
    pixel_format: str,
    width: int,
    height: int,
    fps: float,
    frame_interval_100ns: int | None = None,
) -> VideoFormatOption:
    fd = _open_video_device(device_path)
    try:
        fcntl.ioctl(fd, VIDIOC_S_FMT, build_format_buffer(pixel_format, width, height))
        fcntl.ioctl(fd, VIDIOC_S_PARM, build_streamparm_buffer(fps, frame_interval_100ns))
        return _read_current_format(fd)
    except OSError as exc:
        raise NativeV4L2Error(f"Unable to set V4L2 format on {device_path}: {exc}") from exc
    finally:
        os.close(fd)


def build_format_buffer(pixel_format: str, width: int, height: int) -> bytes:
    pixel_format_code = fourcc(pixel_format)
    pix_format = struct.pack(
        "=12I",
        width,
        height,
        pixel_format_code,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
    )
    return struct.pack("=I", V4L2_BUF_TYPE_VIDEO_CAPTURE) + pix_format + bytes(
        V4L2_FORMAT_SIZE - 4 - V4L2_PIX_FORMAT_SIZE
    )


def build_streamparm_buffer(fps: float, frame_interval_100ns: int | None = None) -> bytes:
    if frame_interval_100ns is not None:
        if frame_interval_100ns <= 0:
            raise ValueError("frame interval must be greater than 0")
        timeperframe = Fraction(frame_interval_100ns, 10_000_000)
    else:
        if fps <= 0:
            raise ValueError("fps must be greater than 0")
        timeperframe = Fraction(1, 1) / Fraction(str(fps)).limit_denominator(1_000_000)
    capture_parm = struct.pack(
        "=IIIIII4I",
        0,
        0,
        timeperframe.numerator,
        timeperframe.denominator,
        0,
        0,
        0,
        0,
        0,
        0,
    )
    return struct.pack("=I", V4L2_BUF_TYPE_VIDEO_CAPTURE) + capture_parm + bytes(
        V4L2_STREAMPARM_SIZE - 4 - V4L2_CAPTUREPARM_SIZE
    )


def _read_current_format(fd: int) -> VideoFormatOption:
    format_buffer = bytearray(V4L2_FORMAT_SIZE)
    struct.pack_into("=I", format_buffer, 0, V4L2_BUF_TYPE_VIDEO_CAPTURE)
    fcntl.ioctl(fd, VIDIOC_G_FMT, format_buffer, True)
    width, height, pixel_format = struct.unpack_from("=III", format_buffer, 4)

    frame_interval_100ns = _read_current_frame_interval_100ns(fd)
    fps = 10_000_000 / frame_interval_100ns if frame_interval_100ns is not None else 0.0
    pixel_format_text = fourcc_text(pixel_format)
    label_fps = _format_fps_label(fps) if fps > 0 else "unknown"
    return VideoFormatOption(
        pixel_format=pixel_format_text,
        description="Current device format",
        width=width,
        height=height,
        fps=fps,
        frame_interval_100ns=frame_interval_100ns,
        label=f"{pixel_format_text} {width}x{height} {label_fps}fps",
    )


def _read_current_frame_interval_100ns(fd: int) -> int | None:
    streamparm_buffer = bytearray(V4L2_STREAMPARM_SIZE)
    struct.pack_into("=I", streamparm_buffer, 0, V4L2_BUF_TYPE_VIDEO_CAPTURE)
    try:
        fcntl.ioctl(fd, VIDIOC_G_PARM, streamparm_buffer, True)
    except OSError:
        return None
    numerator, denominator = struct.unpack_from("=II", streamparm_buffer, 12)
    if numerator <= 0 or denominator <= 0:
        return None
    return round((numerator / denominator) * 10_000_000)


def fourcc(pixel_format: str) -> int:
    if len(pixel_format) != 4:
        raise ValueError("pixel format must be a four-character V4L2 code")
    encoded = pixel_format.encode("ascii")
    return encoded[0] | (encoded[1] << 8) | (encoded[2] << 16) | (encoded[3] << 24)


def fourcc_text(value: int) -> str:
    return bytes(
        [
            value & 0xFF,
            (value >> 8) & 0xFF,
            (value >> 16) & 0xFF,
            (value >> 24) & 0xFF,
        ]
    ).decode("ascii", errors="replace")


def native_control_name(label: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    return normalized


def _inspect_device_sync(device_path: str) -> Device:
    fd = _open_video_device(device_path)
    try:
        buffer = bytearray(V4L2_CAPABILITY_SIZE)
        fcntl.ioctl(fd, VIDIOC_QUERYCAP, buffer, True)
        driver = _decode_c_string(buffer[0:16])
        card = _decode_c_string(buffer[16:48])
        bus_info = _decode_c_string(buffer[48:80])
        capabilities, device_caps = struct.unpack_from("=II", buffer, 84)
        effective_caps = device_caps if capabilities & V4L2_CAP_DEVICE_CAPS else capabilities
        return Device(
            path=device_path,
            name=card or os.path.basename(device_path),
            driver=driver or None,
            bus_info=bus_info or None,
            is_capture=bool(effective_caps & V4L2_CAP_VIDEO_CAPTURE),
        )
    except OSError as exc:
        raise NativeV4L2Error(f"Unable to inspect V4L2 device {device_path}: {exc}") from exc
    finally:
        os.close(fd)


def _list_controls_sync(device_path: str) -> list[V4L2Control]:
    fd = _open_video_device(device_path)
    controls: list[V4L2Control] = []
    try:
        query_id = V4L2_CTRL_FLAG_NEXT_CTRL
        while True:
            buffer = bytearray(V4L2_QUERYCTRL_SIZE)
            struct.pack_into("=I", buffer, 0, query_id)
            try:
                fcntl.ioctl(fd, VIDIOC_QUERYCTRL, buffer, True)
            except OSError as exc:
                if exc.errno == errno.EINVAL:
                    break
                raise

            (
                control_id,
                control_type,
                raw_name,
                minimum,
                maximum,
                step,
                default,
                flags,
            ) = _unpack_queryctrl(buffer)
            query_id = control_id | V4L2_CTRL_FLAG_NEXT_CTRL
            if control_type == V4L2_CTRL_TYPE_CTRL_CLASS:
                continue

            label = _decode_c_string(raw_name)
            name = native_control_name(label)
            kind = _control_kind(control_type)
            value = _get_control_value(fd, control_id, default)
            menu = _list_menu_options(fd, control_id, control_type, minimum, maximum)
            value_label = next((option.label for option in menu if option.value == value), None)
            controls.append(
                V4L2Control(
                    name=name,
                    label=label,
                    control_id=f"0x{control_id:08x}",
                    group=_control_group(control_id),
                    kind=kind,
                    value=value,
                    default=default,
                    min=minimum,
                    max=maximum,
                    step=step,
                    value_label=value_label,
                    flags=_control_flags(flags),
                    menu=menu,
                )
            )
        return controls
    except OSError as exc:
        raise NativeV4L2Error(f"Unable to list V4L2 controls on {device_path}: {exc}") from exc
    finally:
        os.close(fd)


def _list_formats_sync(device_path: str) -> list[VideoFormatOption]:
    fd = _open_video_device(device_path)
    options: list[VideoFormatOption] = []
    try:
        format_index = 0
        while True:
            fmt_buffer = bytearray(V4L2_FMTDESC_SIZE)
            struct.pack_into("=II", fmt_buffer, 0, format_index, V4L2_BUF_TYPE_VIDEO_CAPTURE)
            try:
                fcntl.ioctl(fd, VIDIOC_ENUM_FMT, fmt_buffer, True)
            except OSError as exc:
                if exc.errno == errno.EINVAL:
                    break
                raise

            description = _decode_c_string(fmt_buffer[12:44])
            pixel_format = struct.unpack_from("=I", fmt_buffer, 44)[0]
            pixel_format_text = fourcc_text(pixel_format)
            for width, height in _frame_sizes(fd, pixel_format):
                for fps, frame_interval_100ns in _frame_rates(fd, pixel_format, width, height):
                    label = f"{pixel_format_text} {width}x{height} {_format_fps_label(fps)}fps"
                    options.append(
                        VideoFormatOption(
                            pixel_format=pixel_format_text,
                            description=description,
                            width=width,
                            height=height,
                            fps=fps,
                            frame_interval_100ns=frame_interval_100ns,
                            label=label,
                        )
                    )
            format_index += 1
        return options
    except OSError as exc:
        raise NativeV4L2Error(f"Unable to list V4L2 formats on {device_path}: {exc}") from exc
    finally:
        os.close(fd)


def _unpack_queryctrl(buffer: bytes) -> tuple[int, int, bytes, int, int, int, int, int]:
    control_id, control_type = struct.unpack_from("=II", buffer, 0)
    name = bytes(buffer[8:40])
    minimum, maximum, step, default, flags = struct.unpack_from("=iiiii", buffer, 40)
    return control_id, control_type, name, minimum, maximum, step, default, flags


def _get_control_value(fd: int, control_id: int, fallback: int) -> int:
    buffer = bytearray(struct.pack("=Ii", control_id, 0))
    try:
        fcntl.ioctl(fd, VIDIOC_G_CTRL, buffer, True)
    except OSError as exc:
        if exc.errno in {errno.EACCES, errno.EINVAL}:
            return fallback
        raise
    return struct.unpack_from("=i", buffer, 4)[0]


def _list_menu_options(
    fd: int,
    control_id: int,
    control_type: int,
    minimum: int,
    maximum: int,
) -> list[MenuOption]:
    if control_type not in {V4L2_CTRL_TYPE_MENU, V4L2_CTRL_TYPE_INTEGER_MENU}:
        return []

    options: list[MenuOption] = []
    for index in range(minimum, maximum + 1):
        buffer = bytearray(V4L2_QUERYMENU_SIZE)
        struct.pack_into("=II", buffer, 0, control_id, index)
        try:
            fcntl.ioctl(fd, VIDIOC_QUERYMENU, buffer, True)
        except OSError as exc:
            if exc.errno == errno.EINVAL:
                continue
            raise
        label = _decode_c_string(buffer[8:40]) if control_type == V4L2_CTRL_TYPE_MENU else str(index)
        options.append(MenuOption(value=index, label=label))
    return options


def _frame_sizes(fd: int, pixel_format: int) -> list[tuple[int, int]]:
    sizes: list[tuple[int, int]] = []
    index = 0
    while True:
        buffer = bytearray(V4L2_FRMSIZEENUM_SIZE)
        struct.pack_into("=II", buffer, 0, index, pixel_format)
        try:
            fcntl.ioctl(fd, VIDIOC_ENUM_FRAMESIZES, buffer, True)
        except OSError as exc:
            if exc.errno == errno.EINVAL:
                break
            raise
        frame_size_type = struct.unpack_from("=I", buffer, 8)[0]
        if frame_size_type == V4L2_FRMSIZE_TYPE_DISCRETE:
            width, height = struct.unpack_from("=II", buffer, 12)
            sizes.append((width, height))
        index += 1
    return sizes


def _frame_rates(fd: int, pixel_format: int, width: int, height: int) -> list[tuple[float, int]]:
    rates: list[tuple[float, int]] = []
    index = 0
    while True:
        buffer = bytearray(V4L2_FRMIVALENUM_SIZE)
        struct.pack_into("=IIII", buffer, 0, index, pixel_format, width, height)
        try:
            fcntl.ioctl(fd, VIDIOC_ENUM_FRAMEINTERVALS, buffer, True)
        except OSError as exc:
            if exc.errno == errno.EINVAL:
                break
            raise
        frame_interval_type = struct.unpack_from("=I", buffer, 16)[0]
        if frame_interval_type == V4L2_FRMIVAL_TYPE_DISCRETE:
            numerator, denominator = struct.unpack_from("=II", buffer, 20)
            if numerator > 0 and denominator > 0:
                fps = denominator / numerator
                frame_interval_100ns = round((numerator / denominator) * 10_000_000)
                rates.append((fps, frame_interval_100ns))
        index += 1
    return rates


def _control_kind(control_type: int) -> str:
    if control_type == V4L2_CTRL_TYPE_BOOLEAN:
        return "bool"
    if control_type in {V4L2_CTRL_TYPE_MENU, V4L2_CTRL_TYPE_INTEGER_MENU}:
        return "menu"
    if control_type == V4L2_CTRL_TYPE_INTEGER:
        return "int"
    return "unknown"


def _control_group(control_id: int) -> str:
    control_class = control_id & 0x0FFF0000
    if control_class == V4L2_CTRL_CLASS_CAMERA:
        return "Camera Controls"
    if control_class == V4L2_CTRL_CLASS_USER:
        return "User Controls"
    return "Other Controls"


def _control_flags(flags: int) -> list[str]:
    names: list[str] = []
    if flags & V4L2_CTRL_FLAG_DISABLED:
        names.append("disabled")
    if flags & V4L2_CTRL_FLAG_INACTIVE:
        names.append("inactive")
    if flags & V4L2_CTRL_FLAG_READ_ONLY:
        names.append("read-only")
    if flags & V4L2_CTRL_FLAG_WRITE_ONLY:
        names.append("write-only")
    return names


def _decode_c_string(value: bytes | bytearray) -> str:
    return bytes(value).split(b"\x00", 1)[0].decode("utf-8", errors="replace")


def _format_fps_label(fps: float) -> str:
    rounded = round(fps)
    if abs(fps - rounded) < 0.001:
        return str(rounded)
    return f"{fps:.3f}".rstrip("0").rstrip(".")


def _open_video_device(device_path: str) -> int:
    try:
        return os.open(device_path, os.O_RDWR | getattr(os, "O_CLOEXEC", 0))
    except OSError as exc:
        raise NativeV4L2Error(f"Unable to open V4L2 device {device_path}: {exc}") from exc
