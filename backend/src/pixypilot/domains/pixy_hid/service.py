import asyncio
import json
import os
import select
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from pixypilot.config import hid_path_override, hid_report_gap_seconds, project_root
from pixypilot.domains.pixy_hid.commands import (
    AUTO_ROTATE_FEATURE,
    MIRROR_HORIZONTAL_FEATURE,
    MIRROR_VERTICAL_FEATURE,
    audio_query_report,
    audio_reports,
    auto_privacy_query_report,
    auto_privacy_reports,
    auto_rotate_reports,
    device_info_query_report,
    feature_query_report,
    focus_metering_query_report,
    focus_metering_reports,
    gesture_query_report,
    gesture_reports,
    mirror_reports,
    ptz_absolute_reports,
    ptz_direction_reports,
    ptz_preset_load_reports,
    ptz_preset_save_reports,
    ptz_recenter_reports,
    ptz_relative_reports,
    ptz_vector_reports,
    target_tracking_query_report,
    target_tracking_reports,
    tracking_capability_query_report,
    tracking_probe_report,
    tracking_query_report,
    tracking_reports,
)
from pixypilot.domains.pixy_hid.models import (
    AudioMode,
    FocusMeteringMode,
    PixyHidCommandResult,
    PixyHidDeviceState,
    PixyHidDiagnosticSnapshot,
    PixyHidQueryName,
    PixyHidRawQueryResult,
    PixyHidStatus,
    PtzDirection,
    TargetTrackingMode,
    TrackingMode,
)

PIXY_VENDOR_ID = "0000328F"
PIXY_PRODUCT_ID = "000000C0"
KNOWN_CONTROLS = [
    "tracking",
    "target_tracking",
    "privacy",
    "gesture",
    "auto_rotate",
    "mirror",
    "focus_metering",
    "auto_privacy",
    "audio_mode",
    "ptz_direction",
    "ptz_relative",
    "ptz_absolute",
    "ptz_recenter",
    "ptz_vector",
    "ptz_preset_save",
    "ptz_preset_load",
]
DEFAULT_REPORT_GAP_SECONDS = 0.025
DEFAULT_QUERY_TIMEOUT_SECONDS = 0.5
_HIDRAW_PATH_CACHE: str | None = None
_HID_IO_LOCK = asyncio.Lock()
TRACKING_RESPONSE_VALUES: dict[int, TrackingMode] = {
    0x02: "privacy",
}
TARGET_TRACKING_RESPONSE_VALUES: dict[int, TargetTrackingMode] = {
    0x00: "off",
    0x01: "face",
    0x02: "half_body",
    0x03: "full_body",
}
AUDIO_RESPONSE_VALUES: dict[int, AudioMode] = {
    0x01: "noise_cancel",
    0x02: "live",
    0x03: "original",
}


@dataclass(frozen=True)
class HidQuerySpec:
    name: PixyHidQueryName
    report: bytes
    value_index: int | None = None
    ascii_start: int | None = None


QUERY_SPECS: dict[PixyHidQueryName, HidQuerySpec] = {
    "tracking_state": HidQuerySpec("tracking_state", tracking_query_report(), value_index=8),
    "target_tracking_state": HidQuerySpec("target_tracking_state", target_tracking_query_report(), value_index=8),
    "tracking_capability": HidQuerySpec("tracking_capability", tracking_capability_query_report(), value_index=8),
    "tracking_probe_0100": HidQuerySpec("tracking_probe_0100", tracking_probe_report(0x00), value_index=8),
    "tracking_probe_0102": HidQuerySpec("tracking_probe_0102", tracking_probe_report(0x02), value_index=8),
    "tracking_probe_0103": HidQuerySpec("tracking_probe_0103", tracking_probe_report(0x03), value_index=8),
    "tracking_probe_0104": HidQuerySpec("tracking_probe_0104", tracking_probe_report(0x04), value_index=8),
    "device_info": HidQuerySpec("device_info", device_info_query_report(), ascii_start=8),
    "audio_state": HidQuerySpec("audio_state", audio_query_report(), value_index=8),
    "gesture_state": HidQuerySpec("gesture_state", gesture_query_report(), value_index=9),
    "auto_privacy_state": HidQuerySpec("auto_privacy_state", auto_privacy_query_report(), value_index=8),
    "focus_metering_state": HidQuerySpec("focus_metering_state", focus_metering_query_report(), value_index=8),
    "mirror_horizontal_state": HidQuerySpec(
        "mirror_horizontal_state",
        feature_query_report(MIRROR_HORIZONTAL_FEATURE),
        value_index=9,
    ),
    "mirror_vertical_state": HidQuerySpec(
        "mirror_vertical_state",
        feature_query_report(MIRROR_VERTICAL_FEATURE),
        value_index=9,
    ),
    "auto_rotate_state": HidQuerySpec(
        "auto_rotate_state",
        feature_query_report(AUTO_ROTATE_FEATURE),
        value_index=9,
    ),
}


class PixyHidService:
    def __init__(self, report_gap_seconds: float | None = None, config_path: Path | None = None) -> None:
        self.config_path = config_path
        self.report_gap_seconds = (
            report_gap_seconds if report_gap_seconds is not None else _configured_report_gap_seconds(config_path)
        )

    async def status(self) -> PixyHidStatus:
        hid_path = self.find_hidraw()
        if hid_path is None:
            return PixyHidStatus(
                available=False,
                reason="EMEET PIXY HID device was not found",
                known_controls=KNOWN_CONTROLS,
            )

        readable = os.access(hid_path, os.R_OK)
        writable = os.access(hid_path, os.W_OK)
        reason = None
        if not writable:
            reason = "HID device is present but not writable by this user"

        return PixyHidStatus(
            available=True,
            path=hid_path,
            readable=readable,
            writable=writable,
            reason=reason,
            known_controls=KNOWN_CONTROLS,
        )

    def find_hidraw(self) -> str | None:
        global _HIDRAW_PATH_CACHE
        configured_path = hid_path_override(self.config_path)
        if configured_path is not None:
            return str(configured_path) if configured_path.exists() else None

        if _HIDRAW_PATH_CACHE and Path(_HIDRAW_PATH_CACHE).exists():
            cached_path = Path(_HIDRAW_PATH_CACHE)
            if self._is_pixy_uevent(self._read_uevent(cached_path)):
                return _HIDRAW_PATH_CACHE
            _HIDRAW_PATH_CACHE = None

        candidates: list[tuple[int, Path]] = []
        for dev in sorted(Path("/dev").glob("hidraw*")):
            uevent = self._read_uevent(dev)
            if self._is_pixy_uevent(uevent):
                candidates.append((self._hidraw_rank(dev), dev))
        if candidates:
            _, dev = min(candidates, key=lambda candidate: (candidate[0], str(candidate[1])))
            _HIDRAW_PATH_CACHE = str(dev)
            return _HIDRAW_PATH_CACHE
        _HIDRAW_PATH_CACHE = None
        return None

    async def set_tracking(self, mode: TrackingMode) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        if mode == "tracking" and await self._tracking_readback_is_privacy(path):
            await self._write_reports(path, tracking_reports("off"))
            await asyncio.sleep(max(self.report_gap_seconds, 0.15))
        await self._write_reports(path, tracking_reports(mode))
        return PixyHidCommandResult(ok=True, command="tracking", value=mode, path=path)

    async def set_target_tracking(
        self,
        mode: TargetTrackingMode,
        x: float = 0.5,
        y: float = 0.5,
        scale: float = 1.0,
    ) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, target_tracking_reports(mode, x, y, scale))
        return PixyHidCommandResult(ok=True, command="target_tracking", value=mode, path=path)

    async def _tracking_readback_is_privacy(self, path: str) -> bool:
        try:
            tracking_query = await self._query_raw_with_path(path, "tracking_state")
        except OSError:
            return False
        return tracking_query.raw_value == 0x02

    async def query_state(self) -> PixyHidDeviceState:
        path = await self._require_writable_path()
        tracking_query = await self._query_raw_with_path(path, "tracking_state")
        target_tracking_query = await self._query_raw_with_path(path, "target_tracking_state")
        audio_query = await self._query_raw_with_path(path, "audio_state")
        gesture_query = await self._query_raw_with_path(path, "gesture_state")
        tracking_response = _hex_to_bytes(tracking_query.response_hex)
        target_tracking_response = _hex_to_bytes(target_tracking_query.response_hex)
        audio_response = _hex_to_bytes(audio_query.response_hex)
        gesture_response = _hex_to_bytes(gesture_query.response_hex)
        target_tracking_floats = _parse_target_tracking_floats(target_tracking_response)
        return PixyHidDeviceState(
            tracking_mode=_parse_tracking_response(tracking_response),
            tracking_raw_value=tracking_query.raw_value,
            tracking_raw_bits=tracking_query.raw_bits,
            target_tracking_mode=_parse_target_tracking_response(target_tracking_response),
            target_tracking_raw_value=target_tracking_query.raw_value,
            target_tracking_x=target_tracking_floats[0],
            target_tracking_y=target_tracking_floats[1],
            target_tracking_scale=target_tracking_floats[2],
            audio_mode=_parse_audio_response(audio_response),
            audio_raw_value=audio_query.raw_value,
            gesture_enabled=_parse_gesture_response(gesture_response),
            gesture_raw_value=gesture_query.raw_value,
            queries={
                "tracking_state": tracking_query,
                "target_tracking_state": target_tracking_query,
                "audio_state": audio_query,
                "gesture_state": gesture_query,
            },
            path=path,
        )

    async def query_raw(self, name: PixyHidQueryName) -> PixyHidRawQueryResult:
        path = await self._require_writable_path()
        return await self._query_raw_with_path(path, name)

    async def query_raw_all(self) -> list[PixyHidRawQueryResult]:
        path = await self._require_writable_path()
        results = []
        for name in QUERY_SPECS:
            results.append(await self._query_raw_with_path(path, name))
        return results

    async def capture_diagnostics(self, save: bool = False) -> PixyHidDiagnosticSnapshot:
        captured_at = datetime.now(UTC).replace(microsecond=0).isoformat()
        queries = await self.query_raw_all()
        path = queries[0].path if queries else await self._require_writable_path()
        snapshot = PixyHidDiagnosticSnapshot(captured_at=captured_at, path=path, queries=queries)
        if not save:
            return snapshot

        output_dir = project_root() / "diagnostics" / "hid"
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = f"pixypilot-hid-{captured_at.replace(':', '').replace('+0000', 'Z')}.json"
        output_path = output_dir / filename
        payload = snapshot.model_dump(mode="json")
        payload["file_path"] = str(output_path)
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return PixyHidDiagnosticSnapshot(**payload)

    async def set_gesture(self, enabled: bool) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, gesture_reports(enabled))
        return PixyHidCommandResult(ok=True, command="gesture", value=enabled, path=path)

    async def set_auto_rotate(self, enabled: bool) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, auto_rotate_reports(enabled))
        return PixyHidCommandResult(ok=True, command="auto_rotate", value=enabled, path=path)

    async def set_mirror(self, horizontal: bool, vertical: bool) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, mirror_reports(horizontal, vertical))
        value = _mirror_value(horizontal, vertical)
        return PixyHidCommandResult(ok=True, command="mirror", value=value, path=path)

    async def set_focus_metering(
        self,
        mode: FocusMeteringMode,
        x: int | None = None,
        y: int | None = None,
    ) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, focus_metering_reports(mode, x, y))
        return PixyHidCommandResult(ok=True, command="focus_metering", value=mode, path=path)

    async def set_audio_mode(self, mode: AudioMode) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, audio_reports(mode))
        return PixyHidCommandResult(ok=True, command="audio_mode", value=mode, path=path)

    async def set_auto_privacy(self, timeout_seconds: int) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, auto_privacy_reports(timeout_seconds))
        return PixyHidCommandResult(
            ok=True,
            command="auto_privacy",
            value=timeout_seconds,
            path=path,
        )

    async def send_ptz_direction(self, direction: PtzDirection) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, ptz_direction_reports(direction))
        return PixyHidCommandResult(ok=True, command="ptz_direction", value=direction, path=path)

    async def send_ptz_relative(self, direction: PtzDirection, degrees: float = 3.0) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, ptz_relative_reports(direction, degrees))
        return PixyHidCommandResult(ok=True, command="ptz_relative", value=f"{direction}:{degrees:g}", path=path)

    async def send_ptz_absolute(self, pan: float, tilt: float) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, ptz_absolute_reports(pan, tilt))
        return PixyHidCommandResult(ok=True, command="ptz_absolute", value=f"{pan:g},{tilt:g}", path=path)

    async def recenter_ptz(self) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, ptz_recenter_reports())
        return PixyHidCommandResult(ok=True, command="ptz_recenter", value="0,0", path=path)

    async def send_ptz_vector(self, x: float, y: float, z: float = 0.0) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, ptz_vector_reports(x, y, z))
        return PixyHidCommandResult(ok=True, command="ptz_vector", value=f"{x},{y},{z}", path=path)

    async def save_ptz_preset(self, slot: int) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, ptz_preset_save_reports(slot))
        return PixyHidCommandResult(ok=True, command="ptz_preset_save", value=slot, path=path)

    async def load_ptz_preset(self, slot: int) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, ptz_preset_load_reports(slot))
        return PixyHidCommandResult(ok=True, command="ptz_preset_load", value=slot, path=path)

    async def _require_writable_path(self) -> str:
        status = await self.status()
        if not status.available or status.path is None:
            raise FileNotFoundError(status.reason or "Pixy HID device not found")
        if not status.writable:
            raise PermissionError(status.reason or "Pixy HID device is not writable")
        return status.path

    async def _write_reports(self, path: str, reports: list[bytes]) -> None:
        async with _HID_IO_LOCK:
            await asyncio.to_thread(self._write_reports_sync, path, reports)

    def _write_reports_sync(self, path: str, reports: list[bytes]) -> None:
        with open(path, "wb", buffering=0) as hidraw:
            for index, report in enumerate(reports):
                hidraw.write(report)
                if index < len(reports) - 1 and self.report_gap_seconds > 0:
                    time.sleep(self.report_gap_seconds)

    def _write_report(self, path: str, report: bytes) -> None:
        # Kept for direct tests and one-off diagnostics.
        with open(path, "wb", buffering=0) as hidraw:
            hidraw.write(report)

    async def _send_recv_report(self, path: str, report: bytes) -> bytes | None:
        async with _HID_IO_LOCK:
            return await asyncio.to_thread(self._send_recv_report_sync, path, report)

    async def _query_raw_with_path(self, path: str, name: PixyHidQueryName) -> PixyHidRawQueryResult:
        spec = QUERY_SPECS[name]
        response = await self._send_recv_report(path, spec.report)
        raw_value = _response_byte(response, spec.value_index) if spec.value_index is not None else None
        return PixyHidRawQueryResult(
            name=spec.name,
            request_hex=_bytes_to_hex(spec.report),
            response_hex=_bytes_to_hex(response),
            value_index=spec.value_index,
            raw_value=raw_value,
            raw_bits=_set_bit_indexes(raw_value),
            ascii_value=_response_ascii(response, spec.ascii_start),
            ascii_preview=_ascii_preview(response),
            path=path,
        )

    def _send_recv_report_sync(self, path: str, report: bytes) -> bytes | None:
        fd = os.open(path, os.O_RDWR | os.O_NONBLOCK)
        try:
            _drain_hidraw(fd)
            os.write(fd, report)
            readable, _, _ = select.select([fd], [], [], DEFAULT_QUERY_TIMEOUT_SECONDS)
            if not readable:
                return None
            try:
                return os.read(fd, 64)
            except BlockingIOError:
                return None
        finally:
            os.close(fd)

    def _read_uevent(self, dev: Path) -> str:
        hidraw_name = dev.name
        uevent_path = Path("/sys/class/hidraw") / hidraw_name / "device" / "uevent"
        try:
            return uevent_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""

    def _is_pixy_uevent(self, uevent: str) -> bool:
        has_id = PIXY_VENDOR_ID in uevent.upper() and PIXY_PRODUCT_ID in uevent.upper()
        has_name = "EMEET" in uevent.upper() and "PIXY" in uevent.upper()
        return has_id or has_name

    def _hidraw_rank(self, dev: Path) -> int:
        descriptor_path = Path("/sys/class/hidraw") / dev.name / "device" / "report_descriptor"
        try:
            descriptor = descriptor_path.read_bytes()
        except OSError:
            return 10
        return 0 if b"\x05\x83\x09\x83" in descriptor else 10


def _configured_report_gap_seconds(config_path: Path | None = None) -> float:
    return hid_report_gap_seconds(config_path)


def _mirror_value(horizontal: bool, vertical: bool) -> str:
    if horizontal and vertical:
        return "hv"
    if horizontal:
        return "h"
    if vertical:
        return "v"
    return "off"


def _parse_tracking_response(response: bytes | None) -> TrackingMode | None:
    if not response or len(response) < 9 or response[0] != 0x09 or (response[1] & 0x1F) != 0x01:
        return None
    return TRACKING_RESPONSE_VALUES.get(response[8])


def _parse_target_tracking_response(response: bytes | None) -> TargetTrackingMode | None:
    if not response or len(response) < 9 or response[0] != 0x09 or (response[1] & 0x1F) != 0x04:
        return None
    if response[2] != 0x01 or response[3] != 0x01:
        return None
    return TARGET_TRACKING_RESPONSE_VALUES.get(response[8])


def _parse_target_tracking_floats(response: bytes | None) -> tuple[float | None, float | None, float | None]:
    if not response or len(response) < 21:
        return (None, None, None)
    if response[0] != 0x09 or (response[1] & 0x1F) != 0x04 or response[2] != 0x01 or response[3] != 0x01:
        return (None, None, None)
    try:
        import struct

        return struct.unpack("<fff", response[9:21])
    except struct.error:
        return (None, None, None)


def _parse_audio_response(response: bytes | None) -> AudioMode | None:
    if not response or len(response) < 9 or response[0] != 0x09 or (response[1] & 0x1F) != 0x05:
        return None
    return AUDIO_RESPONSE_VALUES.get(response[8])


def _parse_gesture_response(response: bytes | None) -> bool | None:
    if not response or len(response) < 10 or response[0] != 0x09 or (response[1] & 0x1F) != 0x04:
        return None
    return response[9] == 0x01


def _response_byte(response: bytes | None, index: int, group: int | None = None) -> int | None:
    if not response or len(response) <= index or response[0] != 0x09:
        return None
    if group is not None and (response[1] & 0x1F) != group:
        return None
    return response[index]


def _bytes_to_hex(value: bytes | None) -> str | None:
    if value is None:
        return None
    return value.hex(" ")


def _hex_to_bytes(value: str | None) -> bytes | None:
    if value is None:
        return None
    return bytes.fromhex(value)


def _set_bit_indexes(value: int | None) -> list[int]:
    if value is None:
        return []
    return [bit for bit in range(8) if value & (1 << bit)]


def _response_ascii(response: bytes | None, start: int | None) -> str | None:
    if response is None or start is None or len(response) <= start:
        return None
    payload = response[start:].split(b"\x00", 1)[0]
    if not payload:
        return None
    try:
        return payload.decode("ascii")
    except UnicodeDecodeError:
        return None


def _ascii_preview(response: bytes | None) -> str | None:
    if response is None:
        return None
    preview = "".join(chr(byte) if 0x20 <= byte <= 0x7E else "." for byte in response)
    return preview.rstrip(".") or None


def _drain_hidraw(fd: int) -> None:
    while True:
        readable, _, _ = select.select([fd], [], [], 0)
        if not readable:
            return
        try:
            os.read(fd, 64)
        except BlockingIOError:
            return


def get_pixy_hid_service() -> PixyHidService:
    return PixyHidService()
