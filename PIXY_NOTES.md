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
    SET 09 02 01 00 00 04 00 04 XX
    XX is timeout seconds, 00 disables
    ACK/query-ish follow-up: 09 02 01 01
    Current inference: this configures how long the camera waits before entering its privacy behavior automatically. A value of 0 disables that automatic transition. This still needs validation against official app behavior.
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
