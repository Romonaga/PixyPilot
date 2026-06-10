EMEET PIXY on Ubuntu 24.04

Findings:
- Camera detected correctly by UVC.
- USB ID:
  328f:00c0 EMEET EMEET PIXY
- Devices:
  /dev/video0
  /dev/video1
  /dev/media0
- HID device:
  /dev/hidraw14
- HID permissions:
  /dev/hidraw14 is root:root 0600 right now, so vendor HID controls need a udev rule or privileged helper before a normal user app can write them.

Formats:
- MJPG up to 3840x2160@30
- YUYV 640x480@30
- Full advertised local formats:
  - MJPG:
    3840x2160@30
    2560x1440@30
    1920x1080@60/30
    1280x960@30
    1280x720@60/30
    1024x576@60/30
    960x720@30
    800x600@30
    640x480@30
    640x360@60/30
  - YUYV:
    640x480@30
    640x360@30

Tests:
- guvcview showed green image.
- ffmpeg capture produced normal image.
- Indicates camera and UVC driver are working.
- Likely guvcview display/decoding issue.

Controls exposed through V4L2:
- pan_absolute
- tilt_absolute
- zoom_absolute
- focus_absolute
- focus_automatic_continuous
- brightness
- contrast
- saturation
- sharpness
- exposure

Controls exposed through standard USB audio/ALSA:
- EMEET PIXY appears as an audio capture card.
- Local card at time of testing: card 3, EMEET PIXY.
- ALSA controls:
  - Mic Capture Switch: boolean, read/write, currently used for mute.
  - Mic Capture Volume: integer 0..10, read/write/read-dB.

Current values:
- zoom_absolute=110
- focus_auto=1

Confirmed V4L2 controls from /dev/video0:
- User Controls:
  - brightness: int 0..255 step 1 default 128 current 128
  - contrast: int 0..255 step 1 default 128 current 128
  - saturation: int 0..255 step 1 default 128 current 128
  - hue: int 0..255 step 1 default 128 current 118
  - white_balance_automatic: bool default 1 current 1
  - gamma: int 0..255 step 1 default 128 current 128
  - gain: int 0..100 step 1 default 0 current 1
  - power_line_frequency: menu current 2
    0 Disabled
    1 50 Hz
    2 60 Hz
  - white_balance_temperature: int 2300..7500 step 1 default 5000 current 5000, inactive while auto white balance is on
  - sharpness: int 0..255 step 1 default 128 current 128
  - backlight_compensation: int 1..2 step 1 default 1 current 1
- Camera Controls:
  - auto_exposure: menu current 3
    1 Manual Mode
    3 Aperture Priority Mode
  - exposure_time_absolute: int 1..5000 step 1 default 300 current 300, inactive while auto exposure is on
  - pan_absolute: int -540000..540000 step 3600 default 0 current 0
  - tilt_absolute: int -324000..324000 step 3600 default 0 current 0
  - focus_absolute: int 0..1023 step 1 default 192 current 512, inactive while continuous autofocus is on
  - focus_automatic_continuous: bool default 1 current 1
  - zoom_absolute: int 100..150 step 1 default 100 current 110
    - pcaps/23.pcapng confirmed EMEET Studio uses this standard UVC Zoom Absolute selector for far/near zoom.
    - Far = 100 (payload 64 00), near = 150 (payload 96 00).
  - zoom_continuous: int 0..0 step 0 default 0 current 0

Reverse-engineered HID base:
- Found gist:
  https://gist.github.com/rm1138/ef132c3a39f3c1effabf6354e2eca965
- The gist targets the exact same USB ID, 328f:00c0.
- The gist says the Pixy exposes two useful control paths:
  - UVC/V4L2 for standard camera/PTZ controls.
  - HID for proprietary smart controls through /dev/hidrawN.
- HID report shape from gist:
  - 32-byte reports.
  - Report ID 0x09.
  - Byte 1 is command group.
  - Bytes 2+ are subcommand/parameters/value.
- HID commands identified by the gist:
  - Tracking mode:
    SET 09 01 01 00 00 01 00 01 XX
    XX values: 00 off/idle, 01 tracking, 02 privacy
    ACK/query-ish follow-up: 09 01 01 01
  - Auto-privacy:
    SET 09 02 01 00 00 04 00 04 XX XX XX XX
    XX XX XX XX is a 32-bit little-endian timeout in seconds, 00 00 00 00 disables
    ACK/query-ish follow-up: 09 02 01 01
    Current inference: this configures how long the camera waits before entering its privacy behavior automatically. A value of 0 disables that automatic transition.
  - Gesture control:
    SET 09 04 02 00 00 02 00 02 02 XX
    XX values: 00 off, 01 on
    ACK/query-ish follow-up: 09 04 02 01 00 01 00 01 02
  - Audio mode:
    SET 09 05 00 03 00 01 00 01 XX
    XX values: 01 noise cancel, 02 live, 03 original
    QRY/follow-up: 09 05 00 04
- These commands should be treated as a confirmed-looking starting point, not as production-safe until tested locally.

USB descriptor details:
- UVC extension unit:
  - Unit ID: 2
  - GUID: 46394292-0cd0-4ae3-8783-3133f9eaaa3b
  - bNumControls: 10
  - bmControls: ff 03 00 00, meaning vendor selectors 1 through 10 are present.
- This extension GUID appears on unrelated cameras too, so the GUID alone does not identify EMEET-specific meanings.
- uvcdynctrl does not have packaged mappings for EMEET/PIXY or this GUID on this machine.
- Without a vendor XML mapping or USB sniffing, the extension selectors have raw metadata but no names.

Raw UVC extension selector probe:
- Probed with:
  uvcdynctrl -d /dev/video0 -G 2:<selector>
- All 10 selectors report flags 0x3, which means GET_CUR and SET_CUR are supported by the device.
- Selector table:
  - selector 1: size 1, min 0x00, max 0xff, step 0x01, current 0x01
  - selector 2: size 1, min 0x00, max 0xff, step 0x01, current 0x00
  - selector 3: size 2, min 0x0000, max 0xffff, step 0x0100, current 0x0001
  - selector 4: size 1, min 0x00, max 0xff, step 0x01, current 0x01
  - selector 5: size 10, min 0x00000000000000000000, max 0xffffffffffffffffffff, step 0x01000000000000000000, current 0x01000000000000000000
  - selector 6: size 1024, min all zero bytes, max all ff bytes, step begins 0x01 then zeroes, current begins 0x01 then zeroes
  - selector 7: size 1, min 0x00, max 0xff, step 0x01, current 0x00
  - selector 8: size 1, min 0x00, max 0xff, step 0x01, current 0x01
  - selector 9: size 1024, min all zero bytes, max all ff bytes, step begins 0x01 then zeroes, current begins 0x01 then zeroes
  - selector 10: size 12, min 0x000000000000000000000000, max 0xffffffffffffffffffffffff, step 0x010000000000000000000000, current 0x2700000000000000000000d8
- Current-value nonzero byte check:
  - selector 1: byte 0 = 0x01
  - selector 2: no nonzero bytes
  - selector 3: byte 1 = 0x01
  - selector 4: byte 0 = 0x01
  - selector 5: byte 0 = 0x01
  - selector 6: byte 0 = 0x01; remaining 1023 bytes are 0x00 on current read
  - selector 7: no nonzero bytes
  - selector 8: byte 0 = 0x01
  - selector 9: byte 0 = 0x01; remaining 1023 bytes are 0x00 on current read
  - selector 10: byte 0 = 0x27, byte 11 = 0xd8
- Initial inference:
  - Selectors 1, 2, 4, 7, and 8 look like one-byte toggles or small modes.
  - Selector 3 looks like a two-byte value or bitfield.
  - Selectors 5 and 10 look like structured command/status payloads.
  - Selectors 6 and 9 are 1024-byte buffers and may be bulk configuration/status payloads, firmware data, calibration data, or command mailboxes.
  - Do not write arbitrary values to these selectors until they are correlated with official app behavior or safely tested with reversible values.

Windows USBPcap baseline:
- Capture file analyzed locally:
  pcaps/01_device_plugin_baseline.pcapng
- Capture facts:
  - Taken on Windows 11 with Dumpcap/Wireshark 4.6.6.
  - USBPcap interface: USBPcap2.
  - 365 packets over 8.420025 seconds.
  - Device address used by the PIXY during capture: bus 2, address 3.
  - Descriptor traffic, UVC class-control traffic, and one HID report descriptor response were present.
- Device descriptor/structure findings:
  - UVC Extension Unit ID 2 is present.
  - Extension GUID: 46394292-0cd0-4ae3-8783-3133f9eaaa3b.
  - Extension bNumControls: 10.
  - Extension bmControls includes selectors 1 through 10.
  - The HID report descriptor confirms report ID 0x09 with 31-byte input and output payloads, matching the 32-byte report shape used by the current HID provider.
- Standard UVC camera controls queried by Windows:
  - Exposure Time Absolute: selector 0x04, GET and SET supported, min 1, max 5000, step 1, default 300.
  - Iris Absolute: selector 0x09, GET and SET supported, min 0, max 128, step 1, default 128. Linux currently does not expose this as a normal V4L2 control.
  - Focus Absolute: selector 0x06, GET and SET supported, min 0, max 1023, step 1, default 192.
  - Focus Relative: selector 0x07, GET and SET supported. This is likely the native AF trigger-style path to investigate.
  - Zoom Absolute: selector 0x0b, GET and SET supported, min 100, max 150, step 1, default 100.
  - Zoom Relative: selector 0x0c, GET and SET supported. This may be more useful than Linux zoom_continuous, which currently exposes as a no-op.
  - PanTilt Absolute: selector 0x0d, GET and SET supported, raw 8-byte signed values. This corresponds to pan_absolute and tilt_absolute.
- Standard UVC processing controls queried by Windows:
  - Backlight Compensation: selector 0x01, min 1, max 2, step 1, default 1.
  - Brightness: selector 0x02, min 0, max 255, step 1, default 128.
  - Contrast: selector 0x03, min 0, max 255, step 1, default 128.
  - Gain: selector 0x04, min 0, max 100, step 1, default 0.
  - Power Line Frequency: selector 0x05, min 1, max 2, step 1, default 2.
  - Hue: selector 0x06, min 0, max 255, step 1, default 128.
  - Saturation: selector 0x07, min 0, max 255, step 1, default 128.
  - Sharpness: selector 0x08, min 0, max 255, step 1, default 128.
  - Gamma: selector 0x09, min 0, max 255, step 1, default 128.
  - White Balance Temperature: selector 0x0a, min 2300, max 7500, step 1, default 5000.
- Baseline writes seen from Windows:
  - Windows issued SET_CUR twice for Processing Unit selector 0x05, value 2. This sets Power Line Frequency to 60 Hz.
- What the baseline does not tell us:
  - It does not name the 10 vendor Extension Unit selectors.
  - It does not exercise Auto Framing, Speaker Tracking, AI modes, or vendor presets.
  - It does not include official EMEET Studio user actions, so it is a map of advertised capability, not a behavior map.
- Next action captures needed:
  - Launch EMEET Studio with no setting changes.
  - Toggle Auto Framing off/on.
  - Toggle Auto Follow off/on.
  - Toggle Speaker Tracking off/on.
  - Toggle Privacy off/on.
  - Toggle Gesture Control off/on.
  - Change each audio mode once.
  - Trigger any AF button or focus lock feature the official app exposes.
  - Change one image-control preset/value at a time.
  - Change one video format/resolution/FPS option at a time.

Windows EMEET Studio launch-idle capture:
- Capture file analyzed locally:
  pcaps/02_emeet_studio_launch_idle.pcapng
- Capture facts:
  - Taken on Windows 11 with Dumpcap/Wireshark 4.6.6.
  - USBPcap interface: USBPcap2.
  - 3639 packets over 46.940095 seconds.
  - File size: 94 MB.
  - High-volume payload is video streaming; useful control signal is 44 HID data packets and 69 UVC control packets.
- String descriptors queried by EMEET Studio:
  - Manufacturer: EMEET.
  - Product: EMEET PIXY.
  - Serial-like device string is queried. Do not publish user-specific serial values in public docs.
- Standard UVC behavior:
  - Studio sets Power Line Frequency to value 2, matching 60 Hz.
  - Studio reads current values for brightness, contrast, exposure, auto exposure, gain, sharpness, saturation, hue, white balance temperature, white balance auto, backlight compensation, zoom, focus, autofocus, pan/tilt, and power-line frequency.
  - Studio negotiates UVC streaming through normal Probe/Commit requests.
  - Final observed preview stream is Format Index 1, Frame Index 3, interval 333333, max frame size 2073600, max payload 3072.
  - Based on the descriptor table, that corresponds to MJPG 1920x1080@30.
- HID startup/status traffic:
  - Studio sends and receives interrupt HID reports on report ID 0x09.
  - Query: 09 01 00 04
    Response begins: 09 01 00 04 00 02 00 02 04 20
    Inference: group 0x01 capability/status query, exact meaning unknown.
  - Query: 09 05 00 04
    Response begins: 09 05 00 04 00 01 00 01 02
    Inference: audio DSP mode query; value 0x02 matches the known Live mode value.
  - Query: 09 04 00 02
    Response begins: 09 04 00 02 00 05 00 05 00 00 00 00 00
    Inference: group 0x04 status/capability query, exact meaning unknown.
  - Queries: 09 04 00 07 with payload values 01, 02, and 04
    Responses echo the requested value.
    Inference: possible per-feature status reads inside group 0x04; needs action captures.
  - Queries: 09 04 00 0e, 09 04 00 0a, 09 04 00 0c
    Responses return one-byte value 00.
    Inference: additional group 0x04 status reads; feature names unknown.
  - Command/query: 09 02 02 03 00 01 00 01 00
    No direct parsed response in this capture.
    Inference: auto-privacy or startup policy related; needs correlation.
  - Query: 09 02 01 01
    Response begins: 09 02 01 01 00 04 00 04 00
    Inference: auto-privacy delay/status query, value 0 in this run.
  - Query: 09 01 01 01
    Responses observed with values 03 and 00 at different times.
    Inference: tracking/privacy state query, but value 03 is not yet decoded.
  - Queries: 09 03 01 16 with sub-values 01, 02, and 03
    Responses are 14-byte payloads echoing the sub-value.
    Inference: group 0x03 structured status/config values; needs action captures.
  - Query: 09 03 01 14
    Response begins with a 13-byte zero payload.
    Inference: unknown group 0x03 status.
  - Queries: 09 41 00 04 and 09 61 00 04
    Responses contain short two-byte values ending in 0x20.
    Inference: unknown capability or version queries.
  - Query: 09 01 00 03
    Response contains an ASCII device/build identifier.
    Do not publish user-specific values in public docs.
  - Query: 09 03 01 17
    Response contains one-byte value 0x20.
    Inference: unknown group 0x03 status.
- Current conclusion:
  - Launching EMEET Studio does not reveal Auto Framing or Speaker Tracking command values by itself.
  - Studio's startup traffic gives us a menu of status/capability queries to compare against one-action captures.
  - No clear UVC Extension Unit selector writes were observed during idle startup; the missing smart features are still more likely HID or HID plus vendor extension status.

Windows EMEET Studio AF toggle capture:
- Capture file analyzed locally:
  pcaps/03_auto_framing_toggle.pcapng
- User action:
  - Capture was originally named as Auto Framing, but the user later clarified this was the AF/autofocus control.
  - AF was on at capture start.
  - User toggled AF off, then toggled it on.
- Capture facts:
  - Taken on Windows 11 with Dumpcap/Wireshark 4.6.6.
  - USBPcap interface: USBPcap2.
  - 6354 packets over 50.467271 seconds.
  - File size: 181 MB.
  - High-volume payload is already-running video streaming.
  - No HID interrupt data packets were decoded in this capture.
  - Only 13 UVC control packets were present, and the toggle signal is very clean.
- Observed off transition at 39.175597 seconds:
  - GET_CUR Camera Terminal entity 0x01 selector 0x08 returned 1.
  - SET_CUR Camera Terminal entity 0x01 selector 0x08 to 0.
  - Wireshark decodes selector 0x08 as Focus, Auto.
  - Studio then SET_CUR Focus Absolute selector 0x06 to 512.
  - Studio read back Focus Absolute 512 and Focus, Auto 0.
- Observed on transition at 44.631097 seconds:
  - GET_CUR Focus, Auto selector 0x08 returned 0.
  - SET_CUR Focus, Auto selector 0x08 to 1.
  - Studio read back Focus Absolute 512 and Focus, Auto 1.
- Current conclusion:
  - This capture maps AF off/on to standard UVC Focus, Auto, not to HID and not to the vendor UVC Extension Unit.
  - This is not the Smart Pixy Auto Framing command.
  - Smart Pixy Auto Framing still needs a separate one-action capture.
  - In PixyPilot terms, this behavior is already covered by the Focus Control auto/manual switch backed by V4L2 focus_automatic_continuous.

Windows EMEET Studio Focus/Metering and Control captures:
- Capture files analyzed locally:
  - pcaps/04_focus_metering_modes.pcapng
  - pcaps/05_standard_tracking_toggle.pcapng
  - pcaps/06_privacy_toggle.pcapng
- User note:
  - The app has a Focus/Metering section with "focus on selected areas", "focus on central areas", and "human face".
  - The app has a Control section with "standard tracking" and "privacy".
  - User reported privacy was accidentally used during capture 5.
- Capture 4 facts:
  - 1940 packets over 14.872082 seconds.
  - HID host commands observed:
    - 09 01 01 00 00 01 00 01 01
    - 09 01 01 00 00 01 00 01 02
    - 09 01 01 00 00 01 00 01 00
    - Multiple 09 04 00 01/02/03 status or mode commands with value 01.
- Capture 5 facts:
  - 2808 packets over 22.021226 seconds.
  - HID host commands observed only in group 0x04:
    - 09 04 00 01 00 05 00 05 02
    - 09 04 00 03 00 05 00 05 02
    - 09 04 00 02 00 00 ...
    - same pattern repeated with values 00 and 01.
- Capture 6 facts:
  - 2197 packets over 17.349502 seconds.
  - HID host command for privacy:
    - 09 01 01 00 00 01 00 01 02
  - Follow-up/status query:
    - 09 01 01 01
  - Device response for current state included value 02.
- Current conclusions:
  - The Control section is confirmed to use the known group 0x01 tracking/privacy mode command:
    - 09 01 01 00 00 01 00 01 XX
    - XX 00 = off/idle
    - XX 01 = standard tracking
    - XX 02 = privacy
  - Capture 6 independently confirms privacy uses value 02.
  - The Focus/Metering section appears to use group 0x04 commands:
    - 09 04 00 01 00 05 00 05 XX
    - 09 04 00 03 00 05 00 05 XX
    - followed by or paired with 09 04 00 02 status/query traffic.
  - Values 00, 01, and 02 were observed for group 0x04 mode-like commands.
  - Exact mapping of group 0x04 values to "selected areas", "central areas", and "human face" still needs either a clean one-mode-per-capture run or a confirmed action order for capture 5.

Windows EMEET Studio clean Focus/Metering mapping:
- Capture files analyzed locally:
  - pcaps/07_metering_selected_area.pcapng
  - pcaps/08_metering_center_area.pcapng
  - pcaps/09_metering_human_face.pcapng
  - pcaps/10-focusareas.pcapng
- User action:
  - Capture 7: selected "focus on selected areas" and clicked an area in the preview.
  - Capture 8: selected "focus on central areas".
  - Capture 9: selected "human face".
- Confirmed Focus/Metering HID value mapping:
  - 00 = focus on central areas
  - 01 = human face
  - 02 = focus on selected areas
- Command pattern for setting a Focus/Metering mode:
  - 09 04 00 01 00 05 00 05 XX ...
  - 09 04 00 03 00 05 00 05 XX ...
  - 09 04 00 02 ...
- The device responds to 09 04 00 02 with:
  - 09 04 00 02 00 05 00 05 XX ...
- Selected-area point payload:
  - Initial selected-area mode set:
    09 04 00 01 00 05 00 05 02 00 00 00 ...
  - After clicking an area:
    09 04 00 01 00 05 00 05 02 0f 00 7f 7f ...
  - Device status response mirrored:
    09 04 00 02 00 05 00 05 02 0f 00 7f 7f ...
  - Capture 10 user action order:
    top-left, top-right, bottom-left, bottom-right, center.
  - Capture 10 selected-area payloads:
    - top-left: 00 00 7f 7f
    - top-right: 7f 00 7f 7f
    - bottom-left: 00 7f 7f 7f
    - bottom-right: 7f 7f 7f 7f
    - center: 38 38 7f 7f
  - Current inference: the first two bytes after the mode value are selected-area X/Y coordinates in a 0x00..0x7f range, origin top-left. The last two bytes were 7f 7f for all known-position clicks and may be region size, bounds, or sentinel values. The center click produced 38 38 rather than an exact midpoint, so preview scaling/margins still need validation before we implement arbitrary click-to-focus.
- Current conclusion:
  - Focus/Metering is HID group 0x04, not UVC.
  - The three mode values are now safe to expose as named modes.
  - Manual selected-area clicking is now plausible, but should remain experimental until preview-to-device coordinate scaling is validated.

Windows EMEET Studio Auto Privacy / Auto-entry Privacy mapping:
- Capture file analyzed locally:
  - pcaps/11-autoprivacy.pcapng
- User action order:
  - 10 seconds
  - 1 minute
  - 15 minutes
  - never
- Confirmed command:
  - 09 02 01 00 00 04 00 04 XX XX XX XX
  - The timeout is a 32-bit little-endian seconds value.
- Confirmed values:
  - 10 seconds: 0a 00 00 00
  - 1 minute: 3c 00 00 00
  - 15 minutes: 84 03 00 00
  - never: 00 00 00 00
- Query/status traffic:
  - Host query: 09 02 01 01
  - Device response mirrors the configured timeout:
    09 02 01 01 00 04 00 04 XX XX XX XX
- Current conclusion:
  - Auto-entry privacy delay is confirmed as HID group 0x02.
  - The earlier single-byte interpretation was incomplete; values above 255 seconds require the full 4-byte field.
  - This configures the automatic privacy timer. Explicit privacy mode still uses group 0x01 value 02.

Windows EMEET Studio Gesture + Auto Rotate mapping:
- Capture file analyzed locally:
  - pcaps/12-on off gesture and rotate.pcapng
- User action order:
  - Gesture Control on
  - Gesture Control off
  - Auto Rotate When Upside Down on
  - Auto Rotate When Upside Down off
- Gesture reconfirmed known command:
  - Set on: 09 04 02 00 00 02 00 02 02 01
  - Set off: 09 04 02 00 00 02 00 02 02 00
  - Query/status: 09 04 02 01 00 01 00 01 02
- Auto Rotate When Upside Down command:
  - Set on: 09 04 00 08 00 02 00 02 04 01
  - Set off: 09 04 00 08 00 02 00 02 04 00
  - Query/status: 09 04 00 07 00 01 00 01 04
  - Device response mirrors state:
    09 04 00 07 00 02 00 02 04 XX
- Additional report observed after auto-rotate on and off:
  - 09 63 02 01 00 02 00 02 01 20
  - Inference: likely async notification or acknowledgement; exact meaning unknown.
- Current conclusion:
  - Auto Rotate When Upside Down is safe to expose as a named HID toggle.
  - It is a group 0x04 feature with feature id 0x04.

Windows EMEET Studio video format mapping:
- Capture file analyzed locally:
  - pcaps/13 video res.pcapng
- User action order:
  - 2K
  - 4K
  - 1080P 60FPS
  - 1080P 30FPS
  - 720P 30FPS
- Final UVC VS_COMMIT_CONTROL writes:
  - 2K:
    - format index 1, frame index 2, interval 333333, frame size 3686400, payload 3072
    - maps to MJPG 2560x1440 @ 30 fps
  - 4K:
    - format index 1, frame index 1, interval 333333, frame size 8294400, payload 3072
    - maps to MJPG 3840x2160 @ 30 fps
  - 1080P 60FPS:
    - format index 1, frame index 3, interval 166666, frame size 2073600, payload 3072
    - maps to MJPG 1920x1080 @ 60 fps
  - 1080P 30FPS:
    - format index 1, frame index 3, interval 333333, frame size 2073600, payload 3072
    - maps to MJPG 1920x1080 @ 30 fps
  - 720P 30FPS:
    - format index 1, frame index 5, interval 333333, frame size 921600, payload 3072
    - maps to MJPG 1280x720 @ 30 fps
- Current conclusion:
  - EMEET Studio uses normal UVC Probe/Commit for these video formats.
  - No vendor HID or UVC Extension Unit command is needed for format switching.
  - Linux should expose this through normal V4L2 format/frame interval handling.

Windows EMEET Studio Audio Mode mapping:
- Capture file analyzed locally:
  - pcaps/14 audio mode.pcapng
- User action order:
  - Live
  - NC
  - Original
- Confirmed command:
  - 09 05 00 03 00 01 00 01 XX
- Confirmed values:
  - NC: 01
  - Live: 02
  - Original: 03
- Query/status traffic:
  - Host query: 09 05 00 04
  - Device response mirrors the configured mode:
    09 05 00 04 00 01 00 01 XX
- Current conclusion:
  - The current PixyPilot audio DSP mapping is correct.
  - EMEET Studio exposes three modes: Live, NC, and Original. No separate Normal mode was present in this UI.

Windows EMEET Studio Effects mapping:
- Capture file analyzed locally:
  - pcaps/15.pcapng
- User action order:
  - Bright
  - Nostalgia
  - Blue
  - Cold
  - Vivid
  - Default
- Current conclusion:
  - Effects are standard UVC Processing Unit control writes.
  - No HID or UVC Extension Unit command was observed.
- Confirmed effect values:
  - Bright:
    - brightness 180
    - contrast 150
    - sharpness 128
    - saturation 128
    - hue 128
  - Nostalgia:
    - brightness 128
    - contrast 128
    - sharpness 80
    - saturation 100
    - hue 128
    - white_balance_automatic 0
    - white_balance_temperature 7500
  - Blue:
    - brightness 128
    - contrast 128
    - sharpness 128
    - saturation 128
    - hue 128
    - white_balance_temperature 4250
    - Note: EMEET Studio did not resend white_balance_automatic 0 in this transition because Nostalgia had already disabled auto WB.
  - Cold:
    - brightness 128
    - contrast 70
    - sharpness 255
    - saturation 170
    - hue 128
    - white_balance_automatic 1
  - Vivid:
    - brightness 170
    - contrast 140
    - sharpness 128
    - saturation 140
    - hue 128
  - Default:
    - brightness 128
    - contrast 128
    - sharpness 128
    - saturation 128
    - hue 128
    - Note: in this capture Default followed Cold, so WB auto was already on and no WB command was sent.

Windows EMEET Studio Anti Flicker mapping:
- Capture file analyzed locally:
  - pcaps/16.pcapng
- User action order:
  - 50Hz
  - 60Hz
- Confirmed path:
  - Standard UVC Processing Unit selector 0x05, Power Line Frequency.
- Confirmed values:
  - 50Hz: 01
  - 60Hz: 02
- Current conclusion:
  - This is already exposed in Linux as V4L2 control power_line_frequency.
  - No HID or UVC Extension Unit command is needed.

Windows EMEET Studio Mirror / Flip mapping:
- Capture file analyzed locally:
  - pcaps/17.pcapng
- User action reported:
  - flip vertical
  - flip horizontal
- Confirmed path:
  - Vendor HID group 0x04 feature toggles.
- Command shape:
  - Set: 09 04 00 08 00 02 00 02 FF XX
  - Query/status: 09 04 00 07 00 01 00 01 FF
  - Response: 09 04 00 07 00 02 00 02 FF XX
- Confirmed feature ids based on reported capture order:
  - FF 02 = vertical flip
  - FF 01 = horizontal flip
- Confirmed values:
  - XX 00 = off
  - XX 01 = on
- Current conclusion:
  - Horizontal and vertical flip are independent HID toggles.
  - PixyPilot can expose these as Mirror Off/H/V/HV.

Windows EMEET Studio monitor / mic listen mapping:
- Capture file analyzed locally:
  - pcaps/18.pcapng
- User action reported:
  - Turned on monitor/mic listen.
  - Moved a setting from 100 to 0, then back to 100.
- Observed USB behavior:
  - At 9.509850s, host sent SET_INTERFACE alternate setting 1 on interface 3.
  - At 9.514586s, host sent a USB Audio class endpoint SET_CUR:
    - bmRequestType 0x22, recipient endpoint
    - bRequest 0x01
    - wValue 0x0100
    - wIndex 0x0083
    - wLength 3
    - payload 80 bb 00
  - 0x00bb80 little-endian is 48000, so this sets audio endpoint 0x83 sample frequency to 48000 Hz.
  - At 12.351009s, host sent SET_INTERFACE alternate setting 0 on interface 3.
- Current conclusion:
  - Monitor/mic listen appears to be normal USB Audio streaming setup/teardown, not an EMEET HID smart command.
  - The 100 -> 0 -> 100 slider did not produce a visible USB control write in this capture.
  - Current inference: that slider is likely local EMEET Studio monitor/playback volume on the Windows machine, not a persisted camera-side control.
  - PixyPilot already controls the camera microphone capture path through ALSA mute/volume. A monitor/listen feature would be an application playback feature, not a camera hardware feature.

Windows EMEET Studio follow-mode / recording-start capture:
- Capture file analyzed locally:
  - pcaps/19.pcapng
- User action reported:
  - After setting follow mode, started recording from a recording-related UI location.
- Capture facts:
  - Re-captured file has 4544 packets over 25.647697 seconds and includes PIXY traffic.
  - PIXY device is 2.3.0 / USB ID 328f:00c0.
  - Recording startup negotiated MJPG 1280x720 at 30 fps:
    - UVC format index 1, frame index 5, interval 333333.
    - SET_INTERFACE starts video streaming shortly after the final commit.
  - A PIXY HID input/status packet appears during startup:
    - 09 01 01 01 00 01 00 01 00 ...
    - Group 01 status value 01 means tracking/follow active.
  - No host-to-device HID SET packet for follow was present in this capture.
  - The capture also shows normal USB Audio recording setup:
    - endpoint 0x83 sample frequency payload 80 bb 00, which is 48000 Hz.
- Current conclusion:
  - Recording-area follow appears to use the same tracking mode already decoded from group 01 value 01.
  - PixyPilot already implements that command as Auto Follow / Standard Tracking:
    - SET 09 01 01 00 00 01 00 01 01
  - This capture confirms the state during record startup, but does not add a new command.
  - To capture the actual UI toggle again, start capture before turning follow on/off and stop before doing unrelated recording actions.

Windows EMEET Studio manual rotate-left / rotate-right / restore capture:
- Capture file analyzed locally:
  - pcaps/20.pcapng
- User action reported:
  - Rotated 90 degrees left, rotated 90 degrees right, then restored.
- Capture facts:
  - 2317 packets over 18.100865 seconds.
  - PIXY device 2.3.0 / USB ID 328f:00c0 is present.
  - PIXY control endpoint 2.3.0 only appears during initial descriptor/configuration enumeration.
  - No PIXY HID endpoint 2.3.4 traffic is present.
  - No PIXY UVC control writes, UVC extension writes, HID reports, or USB Audio control writes are present after enumeration.
  - The sustained PIXY traffic is video streaming on endpoint 2.3.2.
- Current conclusion:
  - Manual 90-degree left/right/restore in EMEET Studio appears to be an application-side preview/output transform, not a persisted camera-side USB command.
  - This does not map to the previously decoded Auto Rotate when upside down HID setting.
  - PixyPilot should not expose this as a hardware camera control unless a later isolated capture shows actual PIXY control traffic.
  - If desired, PixyPilot can provide a local preview rotation control in the web UI, but that would transform only the app preview, not the camera hardware state.

Windows EMEET Studio directional PTZ pad capture:
- Capture file analyzed locally:
  - pcaps/21.pcapng
- User action reported:
  - Pressed pan left 3 times, pan right 3 times, tilt up 3 times, tilt down 3 times.
- Capture facts:
  - 2626 packets over 20.570561 seconds.
  - PIXY device 2.3.0 / USB ID 328f:00c0 is present.
  - Directional pad clicks use HID interrupt reports, not standard UVC/V4L2 absolute pan/tilt writes.
  - Host-to-device reports were sent to endpoint 2.3.1, with device status responses from 2.3.4.
  - 9 host PTZ jog reports were visible in the capture, not the full 12 expected from the reported click count.
- Captured host reports:
  - Pan left:
    - 09 63 01 19 00 05 00 05 01 00 00 80 3f ...
    - repeated at 4.467087s, 4.963053s, and 5.478349s.
  - Pan right:
    - 09 63 01 19 00 05 00 05 01 00 00 80 bf ...
    - repeated at 7.405993s and 8.415653s.
  - Tilt up:
    - 09 63 01 19 00 05 00 05 02 00 00 80 3f ...
    - repeated at 10.963318s and 11.930391s.
  - Tilt down:
    - 09 63 01 19 00 05 00 05 02 00 00 80 bf ...
    - repeated at 13.470887s and 14.401157s.
- Current interpretation:
  - Group/command prefix is 09 63 01 19 00 05 00 05.
  - Byte 8 is axis:
    - 01 = pan
    - 02 = tilt
  - Bytes 9..12 are little-endian float32 jog magnitude:
    - 00 00 80 3f = +1.0
    - 00 00 80 bf = -1.0
  - Based on the reported action order:
    - left = pan +1.0
    - right = pan -1.0
    - up = tilt +1.0
    - down = tilt -1.0
  - Device responses looked like status/ack packets:
    - 09 63 01 19 00 02 00 02 01 20 ...
    - 09 63 01 19 00 02 00 02 02 20 ...

Windows EMEET Studio circular PTZ control capture:
- Capture file analyzed locally:
  - pcaps/22.pcapng
- User action reported:
  - Moved the PTZ control in the official program in a clockwise rotation several times.
- Capture facts:
  - 2824 packets over 16.110503 seconds.
  - PIXY device 2.3.0 / USB ID 328f:00c0 is present.
  - Circular control movement uses HID interrupt reports, not standard UVC/V4L2 absolute pan/tilt writes.
  - Host-to-device reports were sent to endpoint 2.3.1, with device status responses from 2.3.4.
  - 198 host vector reports were visible.
  - Device responses looked like status/ack packets:
    - 09 63 01 20 00 01 00 01 20 ...
- Captured host report shape:
  - 09 63 01 20 00 0c 00 0c XX XX XX XX YY YY YY YY ZZ ZZ ZZ ZZ ...
- Current interpretation:
  - Group/command prefix is 09 63 01 20 00 0c 00 0c.
  - The next 12 bytes are three little-endian float32 values.
  - X and Y change with joystick direction.
  - Z remained 0.0 for the capture.
  - Observed X/Y range was approximately -30.0 through +30.0.
  - Example decoded values:
    - a3 8b ae c0 a3 8b 2e 40 00 00 00 00 = x -5.455, y +2.727, z 0.0
    - 00 00 f0 41 00 00 f0 c1 00 00 00 00 = x +30.0, y -30.0, z 0.0
    - 00 00 00 00 00 00 00 00 00 00 00 00 = neutral/stop
  - The final all-zero vector report appears to be the release/stop command.

Capture 23 - Zoom far/near:
- File:
  - pcaps/23.pcapng
- User action:
  - Zoom from far to near, then back to far.
- Capture summary:
  - 1532 packets over 11.715550 seconds.
  - No HID reports were present.
  - Only two meaningful PIXY control writes occurred after streaming was active.
- Decoded UVC writes:
  - Frame 751, time 5.619308s:
    - bmRequestType 0x21, SET_CUR.
    - Camera Terminal entity 0x01, selector 0x0b, Zoom Absolute.
    - Payload 96 00, value 150.
  - Frame 1179, time 8.933809s:
    - bmRequestType 0x21, SET_CUR.
    - Camera Terminal entity 0x01, selector 0x0b, Zoom Absolute.
    - Payload 64 00, value 100.
- Conclusion:
  - EMEET Studio's far/near zoom slider maps directly to Linux `zoom_absolute`.
  - No vendor HID command or UVC extension selector is needed.
  - `zoom_continuous` is still not useful on Linux for this camera because it is exposed as min 0, max 0.

Project direction:
- Build a local FastAPI + React web UI.
- Backend responsibilities:
  - Enumerate V4L2 devices and controls.
  - Return controls as JSON.
  - Validate and set V4L2 control values.
  - Expose Pixy HID controls through a separate provider.
  - Later expose UVC extension selectors as named capabilities only after they are decoded.
- Frontend responsibilities:
  - App.tsx is orchestration/composition only.
  - Camera/device UI should be split into focused components.
  - Reusable behavior belongs in hooks.
  - API clients, types, parsers, validation, and formatting belong in reusable libs.
  - Use smart critical-path tests rather than broad low-value tests.
- Capability buckets:
  - standard_v4l2: confirmed and enumerable now.
  - pixy_hid: reverse-engineered and implemented as an experimental provider, likely usable after hidraw permission fix.
  - uvc_extension: present but unnamed; needs sniffing/correlation before normal app exposure.
- Permission need:
  - Add a udev rule for 328f:00c0 hidraw access, or implement a minimal privileged helper for HID only.

Implemented app status:
- V4L2 device and control enumeration is live through FastAPI.
- V4L2 control writes are live for exposed controls.
- PTZ is now a first-class cockpit panel:
  - directional pan/tilt pad
  - center/home action
  - pan, tilt, and zoom precision sliders
  - auxiliary PTZ controls, including zoom_continuous when exposed
  - app-local PTZ presets for save/goto; camera-native preset storage is not confirmed
  - zoom_continuous is hidden in the UI when it is exposed as min=0 max=0, because that makes it a no-op on this camera
- Pixy HID provider is wired as a separate domain:
  - status endpoint detects the hidraw path
  - tracking mode command
  - gesture command
  - audio mode command
  - auto-privacy timeout command
- Standard USB audio provider is wired as a separate domain:
  - detects the PIXY ALSA capture card
  - reads Mic Capture Switch and Mic Capture Volume
  - toggles microphone mute through Mic Capture Switch
- Current local HID status:
  - /dev/hidraw14 is detected
  - readable=true after installing deploy/udev/70-pixypilot-hid.rules
  - writable=true after installing deploy/udev/70-pixypilot-hid.rules
  - tracking off/idle command returned ok through the REST API
- UI now exposes Smart Pixy controls and enables them when hidraw is writable.
- UVC extension remains read-only in the UI until selectors are correlated with known behavior.
- Smart Pixy UI now mirrors the official-app vocabulary:
  - Auto Follow uses the known HID tracking mode on/off path.
  - Auto Framing is visible but marked capture-needed until a separate command is confirmed.
  - Gesture Control uses the known HID gesture path.
  - Speaker Tracking is visible but marked capture-needed until a separate command is confirmed.

Open investigation:
- Verify the gist HID commands locally after solving /dev/hidraw14 permissions.
- Capture official EMEET Studio traffic for any smart features not covered by the gist.
- Correlate UVC extension selectors by:
  - Snapshotting selector values.
  - Changing one official app setting at a time.
  - Capturing raw selector changes and HID traffic.
  - Repeating with V4L2 control changes to rule out mirrored standard controls.
- Determine whether AI tracking/framing modes use only HID, UVC extension selectors, or both.
