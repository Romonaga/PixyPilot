import asyncio
import os
import time
from pathlib import Path

from pixypilot.domains.pixy_hid.commands import (
    audio_reports,
    auto_privacy_reports,
    auto_rotate_reports,
    focus_metering_reports,
    gesture_reports,
    mirror_reports,
    ptz_direction_reports,
    ptz_preset_load_reports,
    ptz_preset_save_reports,
    ptz_vector_reports,
    tracking_reports,
)
from pixypilot.domains.pixy_hid.models import (
    AudioMode,
    FocusMeteringMode,
    PixyHidCommandResult,
    PixyHidStatus,
    PtzDirection,
    TrackingMode,
)

PIXY_VENDOR_ID = "0000328F"
PIXY_PRODUCT_ID = "000000C0"
KNOWN_CONTROLS = [
    "tracking",
    "privacy",
    "gesture",
    "auto_rotate",
    "mirror",
    "focus_metering",
    "auto_privacy",
    "audio_mode",
    "ptz_direction",
    "ptz_vector",
    "ptz_preset_save",
    "ptz_preset_load",
]
DEFAULT_REPORT_GAP_SECONDS = 0.025


class PixyHidService:
    def __init__(self, report_gap_seconds: float | None = None) -> None:
        self.report_gap_seconds = (
            report_gap_seconds if report_gap_seconds is not None else _configured_report_gap_seconds()
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
        env_path = os.environ.get("PIXYPILOT_HIDRAW")
        if env_path:
            return env_path if Path(env_path).exists() else None

        for dev in sorted(Path("/dev").glob("hidraw*")):
            uevent = self._read_uevent(dev)
            if self._is_pixy_uevent(uevent):
                return str(dev)
        return None

    async def set_tracking(self, mode: TrackingMode) -> PixyHidCommandResult:
        path = await self._require_writable_path()
        await self._write_reports(path, tracking_reports(mode))
        return PixyHidCommandResult(ok=True, command="tracking", value=mode, path=path)

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


def _configured_report_gap_seconds() -> float:
    raw_value = os.environ.get("PIXYPILOT_HID_REPORT_GAP_MS")
    if raw_value is None:
        return DEFAULT_REPORT_GAP_SECONDS
    try:
        return max(0, int(raw_value)) / 1000
    except ValueError:
        return DEFAULT_REPORT_GAP_SECONDS


def _mirror_value(horizontal: bool, vertical: bool) -> str:
    if horizontal and vertical:
        return "hv"
    if horizontal:
        return "h"
    if vertical:
        return "v"
    return "off"


def get_pixy_hid_service() -> PixyHidService:
    return PixyHidService()
