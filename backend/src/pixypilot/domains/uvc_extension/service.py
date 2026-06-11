import asyncio
import json
import os
import struct
import fcntl
from datetime import UTC, datetime
from pathlib import Path

from pixypilot.config import project_root
from pixypilot.domains.uvc_extension.models import (
    UvcExtensionSelectorProbe,
    UvcExtensionSnapshot,
    UvcExtensionValue,
)

UVCIOC_CTRL_QUERY = 0xC0107521
UVC_GET_CUR = 0x81
UVC_GET_MIN = 0x82
UVC_GET_MAX = 0x83
UVC_GET_RES = 0x84
UVC_GET_LEN = 0x85
UVC_GET_INFO = 0x86
UVC_GET_DEF = 0x87
PIXY_EXTENSION_UNIT_ID = 2
PIXY_EXTENSION_SELECTORS = range(1, 11)
KNOWN_SELECTOR_SIZES = {
    1: 1,
    2: 1,
    3: 2,
    4: 1,
    5: 10,
    6: 1024,
    7: 1,
    8: 1,
    9: 1024,
    10: 12,
}


class UvcExtensionService:
    async def probe_selectors(self, device_path: str, unit_id: int = PIXY_EXTENSION_UNIT_ID) -> list[UvcExtensionSelectorProbe]:
        _validate_video_device(device_path)
        return await asyncio.to_thread(_probe_selectors_sync, device_path, unit_id)

    async def capture_snapshot(
        self,
        device_path: str,
        unit_id: int = PIXY_EXTENSION_UNIT_ID,
        save: bool = False,
    ) -> UvcExtensionSnapshot:
        captured_at = datetime.now(UTC).replace(microsecond=0).isoformat()
        output_dir = project_root() / "diagnostics" / "uvc"
        previous_snapshot = _load_latest_snapshot(output_dir, device_path, unit_id)
        selectors = await self.probe_selectors(device_path, unit_id)
        if previous_snapshot is not None:
            _annotate_selector_changes(selectors, previous_snapshot.selectors)

        snapshot = UvcExtensionSnapshot(
            captured_at=captured_at,
            device_path=device_path,
            unit_id=unit_id,
            selectors=selectors,
            previous_file_path=previous_snapshot.file_path if previous_snapshot else None,
            changed_selectors=[selector.selector for selector in selectors if selector.changed_since_previous],
        )
        if not save:
            return snapshot

        output_dir.mkdir(parents=True, exist_ok=True)
        timestamp = captured_at.replace(":", "").replace("+0000", "Z")
        output_path = output_dir / f"pixypilot-uvc-{Path(device_path).name}-{timestamp}.json"
        payload = snapshot.model_dump(mode="json")
        payload["file_path"] = str(output_path)
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return UvcExtensionSnapshot(**payload)


def _probe_selectors_sync(device_path: str, unit_id: int) -> list[UvcExtensionSelectorProbe]:
    fd = os.open(device_path, os.O_RDWR | os.O_NONBLOCK)
    try:
        return [_probe_selector(fd, unit_id, selector) for selector in PIXY_EXTENSION_SELECTORS]
    finally:
        os.close(fd)


def _probe_selector(fd: int, unit_id: int, selector: int) -> UvcExtensionSelectorProbe:
    errors: list[str] = []
    length = _query_length(fd, unit_id, selector, errors)
    info_value = _query_info(fd, unit_id, selector, errors)
    supports_get = bool(info_value is not None and info_value & 0x02)
    supports_set = bool(info_value is not None and info_value & 0x01)
    read_size = length or KNOWN_SELECTOR_SIZES.get(selector, 1)

    return UvcExtensionSelectorProbe(
        unit_id=unit_id,
        selector=selector,
        length=length,
        info=info_value,
        info_flags=_info_flags(info_value),
        supports_get=supports_get,
        supports_set=supports_set,
        current=_query_value(fd, unit_id, selector, UVC_GET_CUR, "current", read_size),
        minimum=_query_value(fd, unit_id, selector, UVC_GET_MIN, "minimum", read_size),
        maximum=_query_value(fd, unit_id, selector, UVC_GET_MAX, "maximum", read_size),
        resolution=_query_value(fd, unit_id, selector, UVC_GET_RES, "resolution", read_size),
        default=_query_value(fd, unit_id, selector, UVC_GET_DEF, "default", read_size),
        errors=errors,
    )


def _query_length(fd: int, unit_id: int, selector: int, errors: list[str]) -> int | None:
    value = _query_bytes(fd, unit_id, selector, UVC_GET_LEN, 2)
    if not value.ok or value.hex_value is None:
        errors.append(value.error or "GET_LEN failed")
        return None
    raw = bytes.fromhex(value.hex_value)
    return int.from_bytes(raw, byteorder="little")


def _query_info(fd: int, unit_id: int, selector: int, errors: list[str]) -> int | None:
    value = _query_bytes(fd, unit_id, selector, UVC_GET_INFO, 1)
    if not value.ok or value.hex_value is None:
        errors.append(value.error or "GET_INFO failed")
        return None
    return int(value.hex_value, 16)


def _query_value(fd: int, unit_id: int, selector: int, query: int, name: str, size: int) -> UvcExtensionValue:
    return _query_bytes(fd, unit_id, selector, query, size, name)


def _query_bytes(fd: int, unit_id: int, selector: int, query: int, size: int, name: str | None = None) -> UvcExtensionValue:
    data = bytearray(size)
    query_buffer = _build_query_buffer(unit_id, selector, query, data)
    label = name or _query_name(query)
    try:
        fcntl.ioctl(fd, UVCIOC_CTRL_QUERY, query_buffer, True)
    except OSError as exc:
        return UvcExtensionValue(query=label, ok=False, size=size, error=str(exc))
    return UvcExtensionValue(
        query=label,
        ok=True,
        size=size,
        hex_value=data.hex(),
        int_value=_little_endian_int(data),
        ascii_preview=_ascii_preview(data),
    )


def _build_query_buffer(unit_id: int, selector: int, query: int, data: bytearray) -> bytearray:
    buffer = bytearray(16)
    struct.pack_into("@BBB", buffer, 0, unit_id, selector, query)
    struct.pack_into("@H", buffer, 4, len(data))
    struct.pack_into("@P", buffer, 8, _bytearray_address(data))
    return buffer


def _bytearray_address(data: bytearray) -> int:
    import ctypes

    return ctypes.addressof(ctypes.c_char.from_buffer(data))


def _query_name(query: int) -> str:
    return {
        UVC_GET_CUR: "current",
        UVC_GET_MIN: "minimum",
        UVC_GET_MAX: "maximum",
        UVC_GET_RES: "resolution",
        UVC_GET_LEN: "length",
        UVC_GET_INFO: "info",
        UVC_GET_DEF: "default",
    }.get(query, f"query_{query:#x}")


def _ascii_preview(data: bytearray | bytes) -> str | None:
    preview = "".join(chr(byte) if 0x20 <= byte <= 0x7E else "." for byte in data)
    return preview.rstrip(".") or None


def _little_endian_int(data: bytearray | bytes) -> int | None:
    if not data or len(data) > 8:
        return None
    return int.from_bytes(data, byteorder="little")


def _info_flags(info_value: int | None) -> list[str]:
    if info_value is None:
        return []
    flags: list[str] = []
    if info_value & 0x02:
        flags.append("GET")
    if info_value & 0x01:
        flags.append("SET")
    if info_value & 0x04:
        flags.append("disabled")
    if info_value & 0x08:
        flags.append("auto_update")
    if info_value & 0x10:
        flags.append("async")
    return flags


def _load_latest_snapshot(output_dir: Path, device_path: str, unit_id: int) -> UvcExtensionSnapshot | None:
    device_name = Path(device_path).name
    candidates = sorted(output_dir.glob(f"pixypilot-uvc-{device_name}-*.json"), key=lambda path: path.name, reverse=True)
    for candidate in candidates:
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
            snapshot = UvcExtensionSnapshot(**payload)
        except (OSError, json.JSONDecodeError, ValueError):
            continue
        if snapshot.device_path == device_path and snapshot.unit_id == unit_id:
            return snapshot
    return None


def _annotate_selector_changes(
    selectors: list[UvcExtensionSelectorProbe],
    previous_selectors: list[UvcExtensionSelectorProbe],
) -> None:
    previous_by_selector = {selector.selector: selector for selector in previous_selectors}
    for selector in selectors:
        previous = previous_by_selector.get(selector.selector)
        if previous is None:
            selector.changed_since_previous = True
            selector.changed_fields = ["selector"]
            continue
        changed_fields = _changed_fields(selector, previous)
        selector.changed_fields = changed_fields
        selector.changed_since_previous = bool(changed_fields)


def _changed_fields(current: UvcExtensionSelectorProbe, previous: UvcExtensionSelectorProbe) -> list[str]:
    fields = [
        "length",
        "info",
        "supports_get",
        "supports_set",
        "current",
        "minimum",
        "maximum",
        "resolution",
        "default",
    ]
    changed: list[str] = []
    for field in fields:
        if _field_signature(getattr(current, field)) != _field_signature(getattr(previous, field)):
            changed.append(field)
    return changed


def _field_signature(value: object) -> object:
    if isinstance(value, UvcExtensionValue):
        return {
            "ok": value.ok,
            "size": value.size,
            "hex_value": value.hex_value,
            "error": value.error,
        }
    return value


def _validate_video_device(device_path: str) -> None:
    if not device_path.startswith("/dev/video"):
        raise ValueError("Only /dev/videoN devices are allowed")
    suffix = device_path.removeprefix("/dev/video")
    if not suffix.isdigit():
        raise ValueError("Only /dev/videoN devices are allowed")


def get_uvc_extension_service() -> UvcExtensionService:
    return UvcExtensionService()
