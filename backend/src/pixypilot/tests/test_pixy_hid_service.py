import json

import pytest

from pixypilot.domains.pixy_hid.models import PixyHidRawQueryResult
from pixypilot.domains.pixy_hid.service import (
    PixyHidService,
    QUERY_SPECS,
    _ascii_preview,
    _parse_audio_response,
    _parse_gesture_response,
    _parse_target_tracking_floats,
    _parse_target_tracking_response,
    _parse_tracking_response,
    _response_ascii,
    _response_byte,
    _set_bit_indexes,
)


def test_report_gap_defaults_to_low_latency_value() -> None:
    service = PixyHidService()

    assert service.report_gap_seconds == 0.025


def test_report_gap_can_be_configured_with_yaml(tmp_path) -> None:
    config_path = tmp_path / "pixypilot.yaml"
    config_path.write_text(
        """
hid:
  report_gap_ms: 75
""",
        encoding="utf-8",
    )

    service = PixyHidService(config_path=config_path)

    assert service.report_gap_seconds == 0.075


def test_parse_tracking_response_values() -> None:
    assert _parse_tracking_response(bytes([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00])) == "off"
    assert _parse_tracking_response(bytes([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01])) == "tracking"
    assert _parse_tracking_response(bytes([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x02])) == "privacy"
    assert _parse_tracking_response(bytes([0x09, 0x01, 0x01, 0x01, 0x00, 0x01, 0x00, 0x01, 0x03])) is None
    assert _parse_tracking_response(bytes([0x09, 0x02, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x02])) is None


def test_parse_tracking_response_masks_status_group_bits() -> None:
    assert _parse_tracking_response(bytes([0x09, 0x21, 0x01, 0x01, 0x00, 0x01, 0x00, 0x01, 0x02])) == "privacy"


def test_parse_target_tracking_response_and_floats() -> None:
    response = bytes.fromhex("09240101000d000d010000003f0000003f0000803f")

    assert _parse_target_tracking_response(response) == "face"
    assert _parse_target_tracking_floats(response) == (0.5, 0.5, 1.0)


def test_parse_audio_response_values() -> None:
    assert _parse_audio_response(bytes([0x09, 0x05, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01])) == "noise_cancel"
    assert _parse_audio_response(bytes([0x09, 0x05, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x02])) == "live"
    assert _parse_audio_response(bytes([0x09, 0x05, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x03])) == "original"
    assert _parse_audio_response(bytes([0x09, 0x05, 0x00])) is None


def test_parse_gesture_response_values() -> None:
    assert _parse_gesture_response(bytes([0x09, 0x04, 0x02, 0x00, 0x00, 0x01, 0x00, 0x01, 0x02, 0x01])) is True
    assert _parse_gesture_response(bytes([0x09, 0x04, 0x02, 0x00, 0x00, 0x01, 0x00, 0x01, 0x02, 0x00])) is False
    assert _parse_gesture_response(bytes([0x09, 0x05, 0x02, 0x00, 0x00, 0x01, 0x00, 0x01, 0x02, 0x01])) is None


def test_response_byte_returns_group_scoped_raw_value() -> None:
    response = bytes([0x09, 0x01, 0x01, 0x01, 0x00, 0x01, 0x00, 0x01, 0x03])
    masked_response = bytes([0x09, 0x21, 0x01, 0x01, 0x00, 0x01, 0x00, 0x01, 0x03])

    assert _response_byte(response, 8, 0x01) == 0x03
    assert _response_byte(masked_response, 8, 0x01) == 0x03
    assert _response_byte(response, 8, 0x05) is None
    assert _response_byte(bytes([0x09, 0x01]), 8, 0x01) is None


def test_query_specs_are_read_only_whitelist() -> None:
    assert QUERY_SPECS["tracking_state"].report[:4] == bytes([0x09, 0x01, 0x01, 0x01])
    assert QUERY_SPECS["target_tracking_state"].report[:4] == bytes([0x09, 0x04, 0x01, 0x01])
    assert QUERY_SPECS["tracking_capability"].report[:4] == bytes([0x09, 0x01, 0x00, 0x04])
    assert QUERY_SPECS["tracking_probe_0100"].report[:4] == bytes([0x09, 0x01, 0x01, 0x00])
    assert QUERY_SPECS["tracking_probe_0102"].report[:4] == bytes([0x09, 0x01, 0x01, 0x02])
    assert QUERY_SPECS["tracking_probe_0103"].report[:4] == bytes([0x09, 0x01, 0x01, 0x03])
    assert QUERY_SPECS["tracking_probe_0104"].report[:4] == bytes([0x09, 0x01, 0x01, 0x04])
    assert QUERY_SPECS["auto_privacy_state"].report[:4] == bytes([0x09, 0x02, 0x01, 0x01])
    assert QUERY_SPECS["mirror_horizontal_state"].report[3] == 0x07


def test_set_bit_indexes_return_potential_bitfield_positions() -> None:
    assert _set_bit_indexes(0x00) == []
    assert _set_bit_indexes(0x03) == [0, 1]
    assert _set_bit_indexes(0x20) == [5]
    assert _set_bit_indexes(None) == []


def test_response_ascii_extracts_zero_terminated_text() -> None:
    response = bytes([0x09, 0x01, 0x00, 0x03, 0x00, 0x06, 0x00, 0x06, *b"PIXY\x00x"])

    assert _response_ascii(response, 8) == "PIXY"
    assert _response_ascii(response, None) is None


def test_ascii_preview_converts_whole_response_to_printable_text() -> None:
    response = bytes([0x09, 0x01, 0x00, 0x03, 0x00, 0x04, 0x00, 0x04, *b"PIXY", 0x00, 0xFF])

    assert _ascii_preview(response) == "........PIXY"
    assert _ascii_preview(bytes([0x00, 0x01])) is None
    assert _ascii_preview(None) is None


@pytest.mark.asyncio
async def test_capture_diagnostics_can_save_snapshot(tmp_path, monkeypatch) -> None:
    service = PixyHidService()
    result = PixyHidRawQueryResult(
        name="tracking_state",
        request_hex="09 01 01 01",
        response_hex="09 01 01 01 00 01 00 01 03",
        value_index=8,
        raw_value=3,
        raw_bits=[0, 1],
        ascii_preview=".........",
        path="/dev/hidraw14",
    )

    async def query_raw_all():
        return [result]

    service.query_raw_all = query_raw_all
    monkeypatch.setattr("pixypilot.domains.pixy_hid.service.project_root", lambda: tmp_path)

    snapshot = await service.capture_diagnostics(save=True)

    assert snapshot.file_path is not None
    output_path = tmp_path / "diagnostics" / "hid" / snapshot.file_path.split("/")[-1]
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["queries"][0]["raw_value"] == 3
    assert payload["queries"][0]["raw_bits"] == [0, 1]
    assert payload["queries"][0]["ascii_preview"] == "........."


@pytest.mark.asyncio
async def test_query_raw_appends_hid_trace_with_request_and_response(tmp_path, monkeypatch) -> None:
    service = PixyHidService()

    async def send_recv_report(path: str, report: bytes):
        assert path == "/dev/hidraw14"
        assert report[:4] == bytes([0x09, 0x01, 0x01, 0x01])
        return bytes([0x09, 0x01, 0x01, 0x01, 0x00, 0x01, 0x00, 0x01, 0x01])

    service._send_recv_report = send_recv_report
    monkeypatch.setattr("pixypilot.domains.pixy_hid.service.project_root", lambda: tmp_path)

    result = await service._query_raw_with_path("/dev/hidraw14", "tracking_state")

    trace_path = tmp_path / "diagnostics" / "hid" / "pixypilot-hid-trace.jsonl"
    event = json.loads(trace_path.read_text(encoding="utf-8").splitlines()[-1])
    assert result.raw_value == 1
    assert event["event"] == "query"
    assert event["operation"] == "tracking_state"
    assert event["request_hex"] == "09 01 01 01" + (" 00" * 28)
    assert event["response_hex"] == "09 01 01 01 00 01 00 01 01"
    assert event["raw_bits"] == [0]


def test_write_reports_appends_hid_trace_with_operation(tmp_path, monkeypatch) -> None:
    service = PixyHidService(report_gap_seconds=0)
    hidraw_path = tmp_path / "hidraw-test"
    report = bytes([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01])
    monkeypatch.setattr("pixypilot.domains.pixy_hid.service.project_root", lambda: tmp_path)

    service._write_reports_sync(str(hidraw_path), [report], operation="tracking:tracking")

    trace_path = tmp_path / "diagnostics" / "hid" / "pixypilot-hid-trace.jsonl"
    event = json.loads(trace_path.read_text(encoding="utf-8").splitlines()[-1])
    assert hidraw_path.read_bytes() == report
    assert event["event"] == "write"
    assert event["operation"] == "tracking:tracking"
    assert event["request_hex"] == "09 01 01 00 00 01 00 01 01"


@pytest.mark.asyncio
async def test_tracking_from_privacy_sends_standard_before_tracking(monkeypatch) -> None:
    service = PixyHidService(report_gap_seconds=0)
    writes: list[list[bytes]] = []
    sleeps: list[float] = []

    async def require_path():
        return "/dev/hidraw14"

    async def query_raw_with_path(path: str, name: str):
        assert path == "/dev/hidraw14"
        assert name == "tracking_state"
        return PixyHidRawQueryResult(
            name="tracking_state",
            request_hex="09 01 01 01",
            response_hex="09 01 01 01 00 01 00 01 02",
            value_index=8,
            raw_value=2,
            raw_bits=[1],
            path=path,
        )

    async def write_reports(path: str, reports: list[bytes], operation: str | None = None):
        assert path == "/dev/hidraw14"
        assert operation is not None
        writes.append(reports)

    async def sleep(seconds: float):
        sleeps.append(seconds)

    service._require_writable_path = require_path
    service._query_raw_with_path = query_raw_with_path
    service._write_reports = write_reports
    monkeypatch.setattr("pixypilot.domains.pixy_hid.service.asyncio.sleep", sleep)

    result = await service.set_tracking("tracking")

    assert result.ok is True
    assert result.value == "tracking"
    assert [reports[0][8] for reports in writes] == [0x00, 0x01]
    assert sleeps == [0.15]


@pytest.mark.asyncio
async def test_target_tracking_uses_pixybar_compatible_report_gap(monkeypatch) -> None:
    service = PixyHidService(report_gap_seconds=0.025)
    writes: list[tuple[list[bytes], float | None]] = []

    async def require_path():
        return "/dev/hidraw14"

    async def write_reports(
        path: str,
        reports: list[bytes],
        operation: str | None = None,
        report_gap_seconds: float | None = None,
    ):
        assert path == "/dev/hidraw14"
        assert operation == "target_tracking:full_body"
        writes.append((reports, report_gap_seconds))

    service._require_writable_path = require_path
    service._write_reports = write_reports

    result = await service.set_target_tracking("full_body")

    assert result.ok is True
    assert writes[0][0][1][8] == 0x03
    assert writes[0][1] == 0.05
