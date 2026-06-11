import struct
from collections.abc import Sequence

from pixypilot.domains.pixy_hid.models import AudioMode, FocusMeteringMode, PtzDirection, TargetTrackingMode, TrackingMode

REPORT_SIZE = 32

TRACKING_VALUES: dict[TrackingMode, int] = {
    "off": 0x00,
    "tracking": 0x01,
    "privacy": 0x02,
}
TARGET_TRACKING_VALUES: dict[TargetTrackingMode, int] = {
    "off": 0x00,
    "face": 0x01,
    "half_body": 0x02,
    "full_body": 0x03,
}

AUDIO_VALUES: dict[AudioMode, int] = {
    "noise_cancel": 0x01,
    "live": 0x02,
    "original": 0x03,
}

MIRROR_HORIZONTAL_FEATURE = 0x01
MIRROR_VERTICAL_FEATURE = 0x02
AUTO_ROTATE_FEATURE = 0x04
PTZ_DIRECTION_VALUES: dict[PtzDirection, tuple[int, float]] = {
    "left": (0x01, 1.0),
    "right": (0x01, -1.0),
    "up": (0x02, 1.0),
    "down": (0x02, -1.0),
}
FOCUS_METERING_VALUES: dict[FocusMeteringMode, int] = {
    "center": 0x00,
    "human_face": 0x01,
    "selected_area": 0x02,
}


def build_report(payload: Sequence[int]) -> bytes:
    if len(payload) > REPORT_SIZE:
        raise ValueError("HID report payload cannot exceed 32 bytes")
    if any(byte < 0 or byte > 0xFF for byte in payload):
        raise ValueError("HID report bytes must be in range 0..255")
    return bytes([*payload, *([0x00] * (REPORT_SIZE - len(payload)))])


def tracking_reports(mode: TrackingMode) -> list[bytes]:
    value = TRACKING_VALUES[mode]
    return [
        build_report([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, value]),
        build_report([0x09, 0x01, 0x01, 0x01]),
    ]


def tracking_query_report() -> bytes:
    return build_report([0x09, 0x01, 0x01, 0x01])


def target_tracking_reports(mode: TargetTrackingMode, x: float = 0.5, y: float = 0.5, scale: float = 1.0) -> list[bytes]:
    if not 0.0 <= x <= 1.0 or not 0.0 <= y <= 1.0:
        raise ValueError("target tracking coordinates must be in range 0.0..1.0")
    if not 0.0 <= scale <= 4.0:
        raise ValueError("target tracking scale must be in range 0.0..4.0")
    value = TARGET_TRACKING_VALUES[mode]
    tracking_value = TRACKING_VALUES["off" if mode == "off" else "tracking"]
    payload = [value, *struct.pack("<fff", x, y, scale)]
    return [
        build_report([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, tracking_value]),
        build_report([0x09, 0x04, 0x01, 0x00, 0x00, 0x0D, 0x00, 0x0D, *payload]),
        build_report([0x09, 0x04, 0x01, 0x01]),
    ]


def target_tracking_query_report() -> bytes:
    return build_report([0x09, 0x04, 0x01, 0x01])


def tracking_probe_report(subcommand: int) -> bytes:
    if subcommand < 0 or subcommand > 0xFF:
        raise ValueError("tracking probe subcommand must be in range 0..255")
    return build_report([0x09, 0x01, 0x01, subcommand])


def tracking_capability_query_report() -> bytes:
    return build_report([0x09, 0x01, 0x00, 0x04])


def device_info_query_report() -> bytes:
    return build_report([0x09, 0x01, 0x00, 0x03])


def gesture_reports(enabled: bool) -> list[bytes]:
    value = 0x01 if enabled else 0x00
    return [
        build_report([0x09, 0x04, 0x02, 0x00, 0x00, 0x02, 0x00, 0x02, 0x02, value]),
        build_report([0x09, 0x04, 0x02, 0x01, 0x00, 0x01, 0x00, 0x01, 0x02]),
    ]


def gesture_query_report() -> bytes:
    return build_report([0x09, 0x04, 0x02, 0x01, 0x00, 0x01, 0x00, 0x01, 0x02])


def focus_metering_query_report() -> bytes:
    return build_report([0x09, 0x04, 0x00, 0x02])


def feature_query_report(feature_id: int) -> bytes:
    return build_report([0x09, 0x04, 0x00, 0x07, 0x00, 0x01, 0x00, 0x01, feature_id])


def feature_toggle_reports(feature_id: int, enabled: bool) -> list[bytes]:
    value = 0x01 if enabled else 0x00
    return [
        build_report([0x09, 0x04, 0x00, 0x08, 0x00, 0x02, 0x00, 0x02, feature_id, value]),
        build_report([0x09, 0x04, 0x00, 0x07, 0x00, 0x01, 0x00, 0x01, feature_id]),
    ]


def auto_rotate_reports(enabled: bool) -> list[bytes]:
    return feature_toggle_reports(AUTO_ROTATE_FEATURE, enabled)


def mirror_reports(horizontal: bool, vertical: bool) -> list[bytes]:
    return [
        *feature_toggle_reports(MIRROR_VERTICAL_FEATURE, vertical),
        *feature_toggle_reports(MIRROR_HORIZONTAL_FEATURE, horizontal),
    ]


def focus_metering_reports(mode: FocusMeteringMode, x: int | None = None, y: int | None = None) -> list[bytes]:
    value = FOCUS_METERING_VALUES[mode]
    x_value = _focus_coordinate(x, 0x38 if mode == "selected_area" else 0x00)
    y_value = _focus_coordinate(y, 0x38 if mode == "selected_area" else 0x00)
    payload = [value, x_value, y_value, 0x7F, 0x7F]
    return [
        build_report([0x09, 0x04, 0x00, 0x01, 0x00, 0x05, 0x00, 0x05, *payload]),
        build_report([0x09, 0x04, 0x00, 0x03, 0x00, 0x05, 0x00, 0x05, *payload]),
        build_report([0x09, 0x04, 0x00, 0x02]),
    ]


def audio_reports(mode: AudioMode) -> list[bytes]:
    value = AUDIO_VALUES[mode]
    return [
        build_report([0x09, 0x05, 0x00, 0x03, 0x00, 0x01, 0x00, 0x01, value]),
        build_report([0x09, 0x05, 0x00, 0x04]),
    ]


def audio_query_report() -> bytes:
    return build_report([0x09, 0x05, 0x00, 0x04])


def auto_privacy_query_report() -> bytes:
    return build_report([0x09, 0x02, 0x01, 0x01])


def auto_privacy_reports(timeout_seconds: int) -> list[bytes]:
    if timeout_seconds < 0 or timeout_seconds > 0xFFFFFFFF:
        raise ValueError("auto-privacy timeout must be in range 0..4294967295")
    timeout_bytes = list(timeout_seconds.to_bytes(4, byteorder="little"))
    return [
        build_report([0x09, 0x02, 0x01, 0x00, 0x00, 0x04, 0x00, 0x04, *timeout_bytes]),
        build_report([0x09, 0x02, 0x01, 0x01]),
    ]


def ptz_direction_reports(direction: PtzDirection) -> list[bytes]:
    axis, delta = PTZ_DIRECTION_VALUES[direction]
    delta_bytes = list(struct.pack("<f", delta))
    return [
        build_report([0x09, 0x63, 0x01, 0x19, 0x00, 0x05, 0x00, 0x05, axis, *delta_bytes]),
    ]


def ptz_relative_reports(direction: PtzDirection, degrees: float = 3.0) -> list[bytes]:
    if degrees <= 0.0 or degrees > 30.0:
        raise ValueError("PTZ relative degrees must be in range 0..30")
    axis, sign = _ptz_motor_axis_and_sign(direction)
    value = sign * degrees
    return [
        build_report([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, TRACKING_VALUES["off"]]),
        build_report([0x09, 0x03, 0x01, 0x19, 0x00, 0x05, 0x00, 0x05, axis, *struct.pack("<f", value)]),
    ]


def ptz_absolute_reports(pan: float, tilt: float) -> list[bytes]:
    if not -90.0 <= pan <= 90.0 or not -90.0 <= tilt <= 90.0:
        raise ValueError("PTZ absolute pan and tilt must be in range -90..90")
    return [
        build_report([0x09, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, TRACKING_VALUES["off"]]),
        build_report([0x09, 0x03, 0x01, 0x18, 0x00, 0x05, 0x00, 0x05, 0x01, *struct.pack("<f", pan)]),
        build_report([0x09, 0x03, 0x01, 0x18, 0x00, 0x05, 0x00, 0x05, 0x02, *struct.pack("<f", tilt)]),
    ]


def ptz_recenter_reports() -> list[bytes]:
    return ptz_absolute_reports(0.0, 0.0)


def ptz_vector_reports(x: float, y: float, z: float = 0.0) -> list[bytes]:
    vector_bytes = list(struct.pack("<fff", x, y, z))
    return [
        build_report([0x09, 0x63, 0x01, 0x20, 0x00, 0x0C, 0x00, 0x0C, *vector_bytes]),
    ]


def ptz_preset_save_reports(slot: int) -> list[bytes]:
    if slot < 1 or slot > 3:
        raise ValueError("PTZ preset slot must be in range 1..3")
    return [
        build_report([0x09, 0x03, 0x01, 0x15, 0x00, 0x02, 0x00, 0x02, slot, 0x01]),
        build_report([0x09, 0x03, 0x01, 0x16, 0x00, 0x01, 0x00, 0x01, slot]),
    ]


def ptz_preset_load_reports(slot: int) -> list[bytes]:
    if slot < 1 or slot > 3:
        raise ValueError("PTZ preset slot must be in range 1..3")
    return [
        build_report([0x09, 0x03, 0x01, 0x18, 0x00, 0x01, 0x00, 0x01, slot]),
    ]


def _focus_coordinate(value: int | None, default: int) -> int:
    resolved = default if value is None else value
    if resolved < 0 or resolved > 0x7F:
        raise ValueError("focus metering coordinates must be in range 0..127")
    return resolved


def _ptz_motor_axis_and_sign(direction: PtzDirection) -> tuple[int, float]:
    if direction == "left":
        return 0x01, -1.0
    if direction == "right":
        return 0x01, 1.0
    if direction == "up":
        return 0x02, 1.0
    return 0x02, -1.0
