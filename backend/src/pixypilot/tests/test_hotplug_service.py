from pixypilot.domains.hotplug.service import _event_from_device


class FakeDevice:
    def __init__(self, subsystem: str, device_node: str | None, action: str | None = "add") -> None:
        self.subsystem = subsystem
        self.device_node = device_node
        self.action = action


def test_video4linux_event_is_mapped_to_video_hotplug_event() -> None:
    event = _event_from_device(FakeDevice("video4linux", "/dev/video0", "add"))

    assert event is not None
    assert event.action == "add"
    assert event.subsystem == "video4linux"
    assert event.device_node == "/dev/video0"
    assert event.device_type == "video"


def test_hidraw_event_is_mapped_to_hid_hotplug_event() -> None:
    event = _event_from_device(FakeDevice("hidraw", "/dev/hidraw14", "change"))

    assert event is not None
    assert event.action == "change"
    assert event.subsystem == "hidraw"
    assert event.device_node == "/dev/hidraw14"
    assert event.device_type == "hid"


def test_unrelated_subsystem_is_ignored() -> None:
    assert _event_from_device(FakeDevice("block", "/dev/sda")) is None
