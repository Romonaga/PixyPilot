import struct
from collections.abc import Sequence

from pixypilot.domains.pixy_hid.models import AudioMode, PtzDirection, TrackingMode

REPORT_SIZE = 32

TRACKING_VALUES: dict[TrackingMode, int] = {
    "off": 0x00,
    "tracking": 0x01,
    "privacy": 0x02,
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


def gesture_reports(enabled: bool) -> list[bytes]:
    value = 0x01 if enabled else 0x00
    return [
        build_report([0x09, 0x04, 0x02, 0x00, 0x00, 0x02, 0x00, 0x02, 0x02, value]),
        build_report([0x09, 0x04, 0x02, 0x01, 0x00, 0x01, 0x00, 0x01, 0x02]),
    ]


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


def audio_reports(mode: AudioMode) -> list[bytes]:
    value = AUDIO_VALUES[mode]
    return [
        build_report([0x09, 0x05, 0x00, 0x03, 0x00, 0x01, 0x00, 0x01, value]),
        build_report([0x09, 0x05, 0x00, 0x04]),
    ]


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
