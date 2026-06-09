import asyncio
import os
from pathlib import Path

from pixypilot.domains.pixy_hid.commands import (
    audio_reports,
    auto_privacy_reports,
    gesture_reports,
    tracking_reports,
)
from pixypilot.domains.pixy_hid.models import (
    AudioMode,
    PixyHidCommandResult,
    PixyHidStatus,
    TrackingMode,
)

PIXY_VENDOR_ID = "0000328F"
PIXY_PRODUCT_ID = "000000C0"
KNOWN_CONTROLS = ["tracking", "privacy", "gesture", "auto_privacy", "audio_mode"]
REPORT_GAP_SECONDS = 0.2


class PixyHidService:
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

    async def _require_writable_path(self) -> str:
        status = await self.status()
        if not status.available or status.path is None:
            raise FileNotFoundError(status.reason or "Pixy HID device not found")
        if not status.writable:
            raise PermissionError(status.reason or "Pixy HID device is not writable")
        return status.path

    async def _write_reports(self, path: str, reports: list[bytes]) -> None:
        for index, report in enumerate(reports):
            await asyncio.to_thread(self._write_report, path, report)
            if index < len(reports) - 1:
                await asyncio.sleep(REPORT_GAP_SECONDS)

    def _write_report(self, path: str, report: bytes) -> None:
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


def get_pixy_hid_service() -> PixyHidService:
    return PixyHidService()
