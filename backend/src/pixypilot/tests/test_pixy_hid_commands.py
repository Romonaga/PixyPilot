from pixypilot.domains.pixy_hid.commands import (
    REPORT_SIZE,
    audio_query_report,
    audio_reports,
    auto_privacy_query_report,
    auto_privacy_reports,
    auto_rotate_reports,
    build_report,
    device_info_query_report,
    feature_query_report,
    focus_metering_query_report,
    focus_metering_reports,
    gesture_query_report,
    gesture_reports,
    MIRROR_HORIZONTAL_FEATURE,
    mirror_reports,
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


def test_build_report_pads_to_32_bytes() -> None:
    report = build_report([0x09, 0x01])

    assert len(report) == REPORT_SIZE
    assert report[:2] == bytes([0x09, 0x01])
    assert report[2:] == bytes([0x00] * 30)


def test_tracking_reports_match_reverse_engineered_sequence() -> None:
    set_report, ack_report = tracking_reports("tracking")

    assert set_report[:9] == bytes([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01])
    assert ack_report[:4] == bytes([0x09, 0x01, 0x01, 0x01])


def test_tracking_query_report_matches_known_status_query() -> None:
    assert tracking_query_report()[:4] == bytes([0x09, 0x01, 0x01, 0x01])


def test_target_tracking_reports_match_pixybar_shape() -> None:
    mode_report, target_report, query_report = target_tracking_reports("face")

    assert mode_report[:9] == bytes([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x01])
    assert target_report[:9] == bytes([0x09, 0x04, 0x01, 0x00, 0x00, 0x0D, 0x00, 0x0D, 0x01])
    assert target_report[9:21] == bytes.fromhex("0000003f0000003f0000803f")
    assert query_report[:4] == bytes([0x09, 0x04, 0x01, 0x01])


def test_target_tracking_off_returns_camera_to_standard_mode() -> None:
    mode_report, target_report, _ = target_tracking_reports("off")

    assert mode_report[8] == 0x00
    assert target_report[8] == 0x00


def test_target_tracking_query_report_matches_pixybar_get_track() -> None:
    assert target_tracking_query_report()[:4] == bytes([0x09, 0x04, 0x01, 0x01])


def test_tracking_probe_reports_match_group_01_probe_shape() -> None:
    assert tracking_probe_report(0x00)[:4] == bytes([0x09, 0x01, 0x01, 0x00])
    assert tracking_probe_report(0x02)[:4] == bytes([0x09, 0x01, 0x01, 0x02])
    assert tracking_probe_report(0x03)[:4] == bytes([0x09, 0x01, 0x01, 0x03])
    assert tracking_probe_report(0x04)[:4] == bytes([0x09, 0x01, 0x01, 0x04])


def test_tracking_capability_query_report_matches_startup_query() -> None:
    assert tracking_capability_query_report()[:4] == bytes([0x09, 0x01, 0x00, 0x04])


def test_device_info_query_report_matches_startup_query() -> None:
    assert device_info_query_report()[:4] == bytes([0x09, 0x01, 0x00, 0x03])


def test_privacy_tracking_mode_uses_value_02() -> None:
    set_report, _ = tracking_reports("privacy")

    assert set_report[8] == 0x02


def test_gesture_reports_match_reverse_engineered_sequence() -> None:
    set_report, ack_report = gesture_reports(True)

    assert set_report[:10] == bytes([0x09, 0x04, 0x02, 0x00, 0x00, 0x02, 0x00, 0x02, 0x02, 0x01])
    assert ack_report[:9] == bytes([0x09, 0x04, 0x02, 0x01, 0x00, 0x01, 0x00, 0x01, 0x02])


def test_gesture_query_report_matches_known_status_query() -> None:
    assert gesture_query_report()[:9] == bytes([0x09, 0x04, 0x02, 0x01, 0x00, 0x01, 0x00, 0x01, 0x02])


def test_focus_metering_query_report_matches_known_status_query() -> None:
    assert focus_metering_query_report()[:4] == bytes([0x09, 0x04, 0x00, 0x02])


def test_feature_query_report_matches_known_status_query() -> None:
    assert feature_query_report(MIRROR_HORIZONTAL_FEATURE)[:9] == bytes(
        [0x09, 0x04, 0x00, 0x07, 0x00, 0x01, 0x00, 0x01, 0x01]
    )


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


def test_focus_metering_reports_match_captured_modes() -> None:
    center_set, center_commit, center_query = focus_metering_reports("center")
    face_set, _, _ = focus_metering_reports("human_face")
    selected_set, selected_commit, _ = focus_metering_reports("selected_area", x=0x7F, y=0x00)

    assert center_set[:13] == bytes([0x09, 0x04, 0x00, 0x01, 0x00, 0x05, 0x00, 0x05, 0x00, 0x00, 0x00, 0x7F, 0x7F])
    assert center_commit[:13] == bytes([0x09, 0x04, 0x00, 0x03, 0x00, 0x05, 0x00, 0x05, 0x00, 0x00, 0x00, 0x7F, 0x7F])
    assert center_query[:4] == bytes([0x09, 0x04, 0x00, 0x02])
    assert face_set[8] == 0x01
    assert selected_set[:13] == bytes([0x09, 0x04, 0x00, 0x01, 0x00, 0x05, 0x00, 0x05, 0x02, 0x7F, 0x00, 0x7F, 0x7F])
    assert selected_commit[8:13] == bytes([0x02, 0x7F, 0x00, 0x7F, 0x7F])


def test_audio_reports_match_reverse_engineered_sequence() -> None:
    set_report, query_report = audio_reports("original")

    assert set_report[:9] == bytes([0x09, 0x05, 0x00, 0x03, 0x00, 0x01, 0x00, 0x01, 0x03])
    assert query_report[:4] == bytes([0x09, 0x05, 0x00, 0x04])


def test_audio_query_report_matches_known_status_query() -> None:
    assert audio_query_report()[:4] == bytes([0x09, 0x05, 0x00, 0x04])


def test_auto_privacy_query_report_matches_known_status_query() -> None:
    assert auto_privacy_query_report()[:4] == bytes([0x09, 0x02, 0x01, 0x01])


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


def test_ptz_relative_reports_match_pixybar_degree_move_shape() -> None:
    mode_report, move_report = ptz_relative_reports("left", degrees=3.0)

    assert mode_report[:9] == bytes([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00])
    assert move_report[:9] == bytes([0x09, 0x03, 0x01, 0x19, 0x00, 0x05, 0x00, 0x05, 0x01])
    assert move_report[9:13] == bytes.fromhex("000040c0")
    assert ptz_relative_reports("right", degrees=3.0)[1][9:13] == bytes.fromhex("00004040")
    assert ptz_relative_reports("up", degrees=1.0)[1][8:13] == bytes.fromhex("020000803f")
    assert ptz_relative_reports("down", degrees=1.0)[1][8:13] == bytes.fromhex("02000080bf")


def test_ptz_recenter_reports_use_absolute_motor_payload_not_preset_slot() -> None:
    mode_report, pan_report, tilt_report = ptz_recenter_reports()

    assert mode_report[:9] == bytes([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00])
    assert pan_report[:9] == bytes([0x09, 0x03, 0x01, 0x18, 0x00, 0x05, 0x00, 0x05, 0x01])
    assert pan_report[9:13] == bytes.fromhex("00000000")
    assert tilt_report[:9] == bytes([0x09, 0x03, 0x01, 0x18, 0x00, 0x05, 0x00, 0x05, 0x02])
    assert tilt_report[9:13] == bytes.fromhex("00000000")


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
