import re

from pixypilot.domains.v4l2.models import MenuOption, V4L2Control

CONTROL_RE = re.compile(
    r"^\s+(?P<name>[A-Za-z0-9_]+)\s+"
    r"(?P<control_id>0x[0-9a-fA-F]+)\s+"
    r"\((?P<kind>[^)]+)\)\s*:\s*(?P<attrs>.*)$"
)
MENU_RE = re.compile(r"^\s+(?P<value>-?\d+):\s*(?P<label>.+)$")
VALUE_LABEL_RE = re.compile(r"\bvalue=-?\d+\s+\((?P<label>[^)]+)\)")


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
