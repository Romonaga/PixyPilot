from pixypilot.domains.pixy_hid.commands import (
    REPORT_SIZE,
    audio_reports,
    auto_privacy_reports,
    auto_rotate_reports,
    build_report,
    gesture_reports,
    mirror_reports,
    ptz_direction_reports,
    ptz_preset_load_reports,
    ptz_preset_save_reports,
    ptz_vector_reports,
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


def test_auto_rotate_reports_match_captured_sequence() -> None:
    set_report, query_report = auto_rotate_reports(True)

    assert set_report[:10] == bytes([0x09, 0x04, 0x00, 0x08, 0x00, 0x02, 0x00, 0x02, 0x04, 0x01])
    assert query_report[:9] == bytes([0x09, 0x04, 0x00, 0x07, 0x00, 0x01, 0x00, 0x01, 0x04])
    assert auto_rotate_reports(False)[0][9] == 0x00


def test_mirror_reports_match_captured_flip_sequence() -> None:
    reports = mirror_reports(horizontal=True, vertical=False)

    assert reports[0][:10] == bytes([0x09, 0x04, 0x00, 0x08, 0x00, 0x02, 0x00, 0x02, 0x02, 0x00])
    assert reports[1][:9] == bytes([0x09, 0x04, 0x00, 0x07, 0x00, 0x01, 0x00, 0x01, 0x02])
    assert reports[2][:10] == bytes([0x09, 0x04, 0x00, 0x08, 0x00, 0x02, 0x00, 0x02, 0x01, 0x01])
    assert reports[3][:9] == bytes([0x09, 0x04, 0x00, 0x07, 0x00, 0x01, 0x00, 0x01, 0x01])


def test_audio_reports_match_reverse_engineered_sequence() -> None:
    set_report, query_report = audio_reports("original")

    assert set_report[:9] == bytes([0x09, 0x05, 0x00, 0x03, 0x00, 0x01, 0x00, 0x01, 0x03])
    assert query_report[:4] == bytes([0x09, 0x05, 0x00, 0x04])


def test_auto_privacy_reports_match_reverse_engineered_sequence() -> None:
    set_report, ack_report = auto_privacy_reports(10)

    assert set_report[:12] == bytes([0x09, 0x02, 0x01, 0x00, 0x00, 0x04, 0x00, 0x04, 0x0A, 0x00, 0x00, 0x00])
    assert ack_report[:4] == bytes([0x09, 0x02, 0x01, 0x01])


def test_auto_privacy_uses_32_bit_little_endian_seconds() -> None:
    assert auto_privacy_reports(0)[0][8:12] == bytes([0x00, 0x00, 0x00, 0x00])
    assert auto_privacy_reports(60)[0][8:12] == bytes([0x3C, 0x00, 0x00, 0x00])
    assert auto_privacy_reports(900)[0][8:12] == bytes([0x84, 0x03, 0x00, 0x00])


def test_ptz_direction_reports_match_capture_21() -> None:
    assert ptz_direction_reports("left")[0][:13] == bytes(
        [0x09, 0x63, 0x01, 0x19, 0x00, 0x05, 0x00, 0x05, 0x01, 0x00, 0x00, 0x80, 0x3F]
    )
    assert ptz_direction_reports("right")[0][:13] == bytes(
        [0x09, 0x63, 0x01, 0x19, 0x00, 0x05, 0x00, 0x05, 0x01, 0x00, 0x00, 0x80, 0xBF]
    )
    assert ptz_direction_reports("up")[0][:13] == bytes(
        [0x09, 0x63, 0x01, 0x19, 0x00, 0x05, 0x00, 0x05, 0x02, 0x00, 0x00, 0x80, 0x3F]
    )
    assert ptz_direction_reports("down")[0][:13] == bytes(
        [0x09, 0x63, 0x01, 0x19, 0x00, 0x05, 0x00, 0x05, 0x02, 0x00, 0x00, 0x80, 0xBF]
    )


def test_ptz_vector_reports_match_capture_22_shape() -> None:
    report = ptz_vector_reports(30.0, -30.0)[0]

    assert report[:8] == bytes([0x09, 0x63, 0x01, 0x20, 0x00, 0x0C, 0x00, 0x0C])
    assert report[8:20] == bytes.fromhex("0000f0410000f0c100000000")
    assert ptz_vector_reports(0.0, 0.0)[0][:20] == bytes.fromhex(
        "09630120000c000c000000000000000000000000"
    )


def test_ptz_preset_save_reports_match_capture_24() -> None:
    save_report, query_report = ptz_preset_save_reports(2)

    assert save_report[:10] == bytes([0x09, 0x03, 0x01, 0x15, 0x00, 0x02, 0x00, 0x02, 0x02, 0x01])
    assert query_report[:9] == bytes([0x09, 0x03, 0x01, 0x16, 0x00, 0x01, 0x00, 0x01, 0x02])


def test_ptz_preset_load_reports_match_capture_25() -> None:
    assert ptz_preset_load_reports(3)[0][:9] == bytes(
        [0x09, 0x03, 0x01, 0x18, 0x00, 0x01, 0x00, 0x01, 0x03]
    )
