import re

from pixypilot.domains.v4l2.models import MenuOption, V4L2Control, VideoFormatOption

CONTROL_RE = re.compile(
    r"^\s+(?P<name>[A-Za-z0-9_]+)\s+"
    r"(?P<control_id>0x[0-9a-fA-F]+)\s+"
    r"\((?P<kind>[^)]+)\)\s*:\s*(?P<attrs>.*)$"
)
MENU_RE = re.compile(r"^\s+(?P<value>-?\d+):\s*(?P<label>.+)$")
VALUE_LABEL_RE = re.compile(r"\bvalue=-?\d+\s+\((?P<label>[^)]+)\)")
FORMAT_RE = re.compile(r"^\s+\[\d+\]:\s+'(?P<pixel_format>[^']+)'\s+\((?P<description>[^)]+)\)")
SIZE_RE = re.compile(r"^\s+Size:\s+Discrete\s+(?P<width>\d+)x(?P<height>\d+)")
INTERVAL_RE = re.compile(r"^\s+Interval:\s+Discrete\s+[0-9.]+s\s+\((?P<fps>[0-9.]+)\s+fps\)")


def label_from_name(name: str) -> str:
    return " ".join(part.capitalize() for part in name.split("_"))


def _extract_int(attrs: str, key: str) -> int | None:
    match = re.search(rf"\b{re.escape(key)}=(-?\d+)", attrs)
    if not match:
        return None
    return int(match.group(1))


def _extract_flags(attrs: str) -> list[str]:
    match = re.search(r"\bflags=(?P<flags>.+)$", attrs)
    if not match:
        return []
    return [flag.strip() for flag in match.group("flags").split(",") if flag.strip()]


def _kind(raw_kind: str) -> str:
    if raw_kind in {"int", "bool", "menu"}:
        return raw_kind
    return "unknown"


def parse_controls(output: str) -> list[V4L2Control]:
    controls: list[V4L2Control] = []
    current_group = "Controls"
    current_control: V4L2Control | None = None

    for line in output.splitlines():
        if not line.strip():
            continue

        menu_match = MENU_RE.match(line)
        if menu_match and current_control is not None:
            current_control.menu.append(
                MenuOption(
                    value=int(menu_match.group("value")),
                    label=menu_match.group("label").strip(),
                )
            )
            continue

        control_match = CONTROL_RE.match(line)
        if control_match:
            attrs = control_match.group("attrs")
            value_label = None
            value_label_match = VALUE_LABEL_RE.search(attrs)
            if value_label_match:
                value_label = value_label_match.group("label")

            control = V4L2Control(
                name=control_match.group("name"),
                label=label_from_name(control_match.group("name")),
                control_id=control_match.group("control_id"),
                group=current_group,
                kind=_kind(control_match.group("kind")),
                min=_extract_int(attrs, "min"),
                max=_extract_int(attrs, "max"),
                step=_extract_int(attrs, "step"),
                default=_extract_int(attrs, "default"),
                value=_extract_int(attrs, "value") or 0,
                value_label=value_label,
                flags=_extract_flags(attrs),
            )
            controls.append(control)
            current_control = control
            continue

        if not line.startswith((" ", "\t")):
            current_group = line.strip()
            current_control = None

    return controls


def parse_video_formats(output: str) -> list[VideoFormatOption]:
    formats: list[VideoFormatOption] = []
    current_format: tuple[str, str] | None = None
    current_size: tuple[int, int] | None = None

    for line in output.splitlines():
        format_match = FORMAT_RE.match(line)
        if format_match:
            current_format = (
                format_match.group("pixel_format"),
                format_match.group("description"),
            )
            current_size = None
            continue

        size_match = SIZE_RE.match(line)
        if size_match:
            current_size = (int(size_match.group("width")), int(size_match.group("height")))
            continue

        interval_match = INTERVAL_RE.match(line)
        if interval_match and current_format is not None and current_size is not None:
            fps = float(interval_match.group("fps"))
            pixel_format, description = current_format
            width, height = current_size
            formats.append(
                VideoFormatOption(
                    pixel_format=pixel_format,
                    description=description,
                    width=width,
                    height=height,
                    fps=fps,
                    label=f"{pixel_format} {width}x{height} {_format_fps(fps)}fps",
                )
            )

    return formats


def _format_fps(fps: float) -> str:
    rounded = round(fps)
    if abs(fps - rounded) < 0.001:
        return str(rounded)
    return f"{fps:.3f}".rstrip("0").rstrip(".")
