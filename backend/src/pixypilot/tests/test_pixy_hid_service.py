from pixypilot.domains.pixy_hid.service import PixyHidService


def test_report_gap_defaults_to_low_latency_value() -> None:
    service = PixyHidService()

    assert service.report_gap_seconds == 0.025


def test_report_gap_can_be_configured_with_env(monkeypatch) -> None:
    monkeypatch.setenv("PIXYPILOT_HID_REPORT_GAP_MS", "75")

    service = PixyHidService()

    assert service.report_gap_seconds == 0.075
