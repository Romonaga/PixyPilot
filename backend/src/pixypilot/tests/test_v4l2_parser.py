from pixypilot.domains.v4l2.parser import parse_controls, parse_video_formats


SAMPLE = """
User Controls

                     brightness 0x00980900 (int)    : min=0 max=255 step=1 default=128 value=128 flags=0x00001000
           power_line_frequency 0x00980918 (menu)   : min=0 max=2 default=2 value=2 (60 Hz)
\t\t\t\t0: Disabled
\t\t\t\t1: 50 Hz
\t\t\t\t2: 60 Hz
      white_balance_temperature 0x0098091a (int)    : min=2300 max=7500 step=1 default=5000 value=5000 flags=inactive, 0x00001000
                      sharpness 0x0098091b (int)    : min=0 max=255 step=1 default=128 value=128 flags=0x00001000

Camera Controls

                  auto_exposure 0x009a0901 (menu)   : min=0 max=3 default=3 value=3 (Aperture Priority Mode)
\t\t\t\t1: Manual Mode
\t\t\t\t3: Aperture Priority Mode
                   pan_absolute 0x009a0908 (int)    : min=-540000 max=540000 step=3600 default=0 value=0 flags=0x00001000
     focus_automatic_continuous 0x009a090c (bool)   : default=1 value=1
"""

FORMAT_SAMPLE = """
ioctl: VIDIOC_ENUM_FMT
    Type: Video Capture

    [0]: 'MJPG' (Motion-JPEG, compressed)
        Size: Discrete 3840x2160
            Interval: Discrete 0.033s (30.000 fps)
        Size: Discrete 2560x1440
            Interval: Discrete 0.033s (30.000 fps)
        Size: Discrete 1920x1080
            Interval: Discrete 0.017s (60.000 fps)
            Interval: Discrete 0.033s (30.000 fps)
        Size: Discrete 1280x720
            Interval: Discrete 0.033s (30.000 fps)
    [1]: 'YUYV' (YUYV 4:2:2)
        Size: Discrete 640x480
            Interval: Discrete 0.033s (30.000 fps)
"""


def test_parse_controls_groups_menu_and_flags() -> None:
    controls = parse_controls(SAMPLE)

    by_name = {control.name: control for control in controls}

    assert by_name["brightness"].group == "User Controls"
    assert by_name["brightness"].kind == "int"
    assert by_name["brightness"].min == 0
    assert by_name["brightness"].max == 255
    assert by_name["brightness"].value == 128

    frequency = by_name["power_line_frequency"]
    assert frequency.kind == "menu"
    assert frequency.value_label == "60 Hz"
    assert [(option.value, option.label) for option in frequency.menu] == [
        (0, "Disabled"),
        (1, "50 Hz"),
        (2, "60 Hz"),
    ]

    assert by_name["white_balance_temperature"].flags == ["inactive", "0x00001000"]
    assert by_name["auto_exposure"].group == "Camera Controls"
    assert by_name["auto_exposure"].value_label == "Aperture Priority Mode"
    assert by_name["focus_automatic_continuous"].kind == "bool"


def test_parse_video_formats_expands_discrete_intervals() -> None:
    formats = parse_video_formats(FORMAT_SAMPLE)

    assert [(item.pixel_format, item.width, item.height, item.fps) for item in formats] == [
        ("MJPG", 3840, 2160, 30.0),
        ("MJPG", 2560, 1440, 30.0),
        ("MJPG", 1920, 1080, 60.0),
        ("MJPG", 1920, 1080, 30.0),
        ("MJPG", 1280, 720, 30.0),
        ("YUYV", 640, 480, 30.0),
    ]
    assert formats[0].label == "MJPG 3840x2160 30fps"
