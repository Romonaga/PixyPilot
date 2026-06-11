import json
import struct

import pytest

from pixypilot.domains.uvc_extension.models import UvcExtensionSelectorProbe, UvcExtensionValue
from pixypilot.domains.uvc_extension.service import (
    PIXY_EXTENSION_UNIT_ID,
    UVCIOC_CTRL_QUERY,
    UVC_GET_CUR,
    UvcExtensionService,
    _ascii_preview,
    _build_query_buffer,
    _info_flags,
    _little_endian_int,
)


def test_uvc_ctrl_query_ioctl_number_matches_linux_header() -> None:
    assert UVCIOC_CTRL_QUERY == 0xC0107521


def test_build_query_buffer_matches_uvc_xu_control_query_layout() -> None:
    data = bytearray(4)
    buffer = _build_query_buffer(PIXY_EXTENSION_UNIT_ID, 3, UVC_GET_CUR, data)

    unit, selector, query = struct.unpack_from("@BBB", buffer, 0)
    size = struct.unpack_from("@H", buffer, 4)[0]
    pointer = struct.unpack_from("@P", buffer, 8)[0]

    assert unit == 2
    assert selector == 3
    assert query == UVC_GET_CUR
    assert size == 4
    assert pointer != 0


def test_ascii_preview_marks_binary_bytes() -> None:
    assert _ascii_preview(bytes([0x00, 0x20, 0x41, 0x7E, 0xFF])) == ". A~"
    assert _ascii_preview(bytes([0x00, 0x01])) is None


def test_little_endian_int_preview_only_handles_small_values() -> None:
    assert _little_endian_int(bytes([0x34, 0x12])) == 0x1234
    assert _little_endian_int(bytes(9)) is None


def test_info_flags_decode_get_set_bits_in_display_order() -> None:
    assert _info_flags(0x03) == ["GET", "SET"]
    assert _info_flags(0x1F) == ["GET", "SET", "disabled", "auto_update", "async"]
    assert _info_flags(None) == []


@pytest.mark.asyncio
async def test_capture_snapshot_can_save_probe_data(tmp_path, monkeypatch) -> None:
    service = UvcExtensionService()
    probe = UvcExtensionSelectorProbe(unit_id=2, selector=1, length=1, info=3, supports_get=True, supports_set=True)

    async def probe_selectors(device_path: str, unit_id: int = 2):
        assert device_path == "/dev/video0"
        assert unit_id == 2
        return [probe]

    service.probe_selectors = probe_selectors
    monkeypatch.setattr("pixypilot.domains.uvc_extension.service.project_root", lambda: tmp_path)

    snapshot = await service.capture_snapshot("/dev/video0", save=True)

    assert snapshot.file_path is not None
    output_path = tmp_path / "diagnostics" / "uvc" / snapshot.file_path.split("/")[-1]
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["selectors"][0]["selector"] == 1
    assert payload["selectors"][0]["supports_get"] is True


@pytest.mark.asyncio
async def test_capture_snapshot_marks_changes_against_previous_saved_snapshot(tmp_path, monkeypatch) -> None:
    service = UvcExtensionService()
    monkeypatch.setattr("pixypilot.domains.uvc_extension.service.project_root", lambda: tmp_path)
    output_dir = tmp_path / "diagnostics" / "uvc"
    output_dir.mkdir(parents=True)
    previous_path = output_dir / "pixypilot-uvc-video0-2026-06-10T120000Z.json"
    previous_probe = UvcExtensionSelectorProbe(
        unit_id=2,
        selector=1,
        length=1,
        info=3,
        supports_get=True,
        supports_set=True,
        current=UvcExtensionValue(query="current", ok=True, size=1, hex_value="00", int_value=0),
    )
    previous_path.write_text(
        json.dumps(
            {
                "captured_at": "2026-06-10T12:00:00+00:00",
                "device_path": "/dev/video0",
                "unit_id": 2,
                "selectors": [previous_probe.model_dump(mode="json")],
                "file_path": str(previous_path),
            }
        ),
        encoding="utf-8",
    )

    current_probe = UvcExtensionSelectorProbe(
        unit_id=2,
        selector=1,
        length=1,
        info=3,
        supports_get=True,
        supports_set=True,
        current=UvcExtensionValue(query="current", ok=True, size=1, hex_value="01", int_value=1),
    )

    async def probe_selectors(device_path: str, unit_id: int = 2):
        assert device_path == "/dev/video0"
        assert unit_id == 2
        return [current_probe]

    service.probe_selectors = probe_selectors

    snapshot = await service.capture_snapshot("/dev/video0", save=False)

    assert snapshot.previous_file_path == str(previous_path)
    assert snapshot.changed_selectors == [1]
    assert snapshot.selectors[0].changed_since_previous is True
    assert snapshot.selectors[0].changed_fields == ["current"]
