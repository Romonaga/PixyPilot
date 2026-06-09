from pixypilot.domains.pixy_hid.commands import (
    REPORT_SIZE,
    audio_reports,
    auto_privacy_reports,
    build_report,
    gesture_reports,
    tracking_reports,
)


def test_build_report_pads_to_32_bytes() -> None:
    report = build_report([0x09, 0x01])

    assert len(report) == REPORT_SIZE
    assert report[:2] == bytes([0x09, 0x01])
    assert report[2:] == bytes([0x00] * 30)


def test_tracking_reports_match_reverse_engineered_sequence() -> None:
    set_report, ack_report = tracking_reports("tracking")

    assert set_report[:9] == bytes([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01])
    assert ack_report[:4] == bytes([0x09, 0x01, 0x01, 0x01])


def test_privacy_tracking_mode_uses_value_02() -> None:
    set_report, _ = tracking_reports("privacy")

    assert set_report[8] == 0x02


def test_gesture_reports_match_reverse_engineered_sequence() -> None:
    set_report, ack_report = gesture_reports(True)

    assert set_report[:10] == bytes([0x09, 0x04, 0x02, 0x00, 0x00, 0x02, 0x00, 0x02, 0x02, 0x01])
    assert ack_report[:9] == bytes([0x09, 0x04, 0x02, 0x01, 0x00, 0x01, 0x00, 0x01, 0x02])


def test_audio_reports_match_reverse_engineered_sequence() -> None:
    set_report, query_report = audio_reports("original")

    assert set_report[:9] == bytes([0x09, 0x05, 0x00, 0x03, 0x00, 0x01, 0x00, 0x01, 0x03])
    assert query_report[:4] == bytes([0x09, 0x05, 0x00, 0x04])


def test_auto_privacy_reports_match_reverse_engineered_sequence() -> None:
    set_report, ack_report = auto_privacy_reports(10)

    assert set_report[:9] == bytes([0x09, 0x02, 0x01, 0x00, 0x00, 0x04, 0x00, 0x04, 0x0A])
    assert ack_report[:4] == bytes([0x09, 0x02, 0x01, 0x01])
