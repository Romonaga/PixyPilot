# EMEET PIXY Linux Reverse Engineering

This document records what PixyPilot has learned about the EMEET PIXY camera so other Linux users can benefit from the work. It separates confirmed behavior from working hypotheses. Do not write arbitrary values to vendor controls unless the command has been correlated with official app behavior or tested safely.

## Device Identity

- USB ID: `328f:00c0`
- USB name observed on Linux: `EMEET EMEET PIXY`
- Main Linux nodes observed:
  - `/dev/video0`: controllable UVC capture node
  - `/dev/video1`: metadata-only node, not useful for user controls
  - `/dev/media0`: media graph node
  - `/dev/hidrawN`: vendor HID smart-control path
- Audio:
  - Exposes a standard USB audio capture device.
  - ALSA controls include `Mic Capture Switch` and `Mic Capture Volume`.

## Control Paths

The PIXY currently appears to have three useful control paths.

| Path | Status | Purpose |
| --- | --- | --- |
| V4L2/UVC | Confirmed | Standard image, focus, exposure, PTZ, and format controls |
| ALSA | Confirmed | Microphone mute and microphone capture volume |
| Vendor HID | Partially confirmed | Smart features such as tracking, privacy, gesture, and audio DSP modes |
| UVC Extension Unit | Present, not decoded | Ten vendor selectors exposed through UVC, names still unknown |

## Confirmed V4L2 Controls

These controls were observed through `/dev/video0` on Ubuntu 24.04.

### Image

- `brightness`: `0..255`, default `128`
- `contrast`: `0..255`, default `128`
- `saturation`: `0..255`, default `128`
- `hue`: `0..255`, default `128`
- `sharpness`: `0..255`, default `128`
- `gamma`: `0..255`, default `128`
- `gain`: `0..100`, default `0`
- `backlight_compensation`: `1..2`, default `1`
- `white_balance_automatic`: boolean, default `1`
- `white_balance_temperature`: `2300..7500`, default `5000`, inactive while auto white balance is on
- `power_line_frequency`: menu
  - `0`: disabled
  - `1`: 50 Hz
  - `2`: 60 Hz

### Exposure

- `auto_exposure`: menu
  - `1`: manual mode
  - `3`: aperture priority mode
- `exposure_time_absolute`: `1..5000`, default `300`, inactive while auto exposure is on

### Focus

- `focus_absolute`: `0..1023`, default `192`, inactive while continuous autofocus is on
- `focus_automatic_continuous`: boolean, default `1`

### PTZ

- `pan_absolute`: `-540000..540000`, step `3600`
- `tilt_absolute`: `-324000..324000`, step `3600`
- `zoom_absolute`: `100..150`, default `100`
- `zoom_continuous`: exposed by Linux as `0..0`, so it behaves as a no-op and should be hidden in normal UI

## Video Formats

Observed advertised formats:

- MJPG:
  - `3840x2160@30`
  - `2560x1440@30`
  - `1920x1080@60/30`
  - `1280x960@30`
  - `1280x720@60/30`
  - `1024x576@60/30`
  - `960x720@30`
  - `800x600@30`
  - `640x480@30`
  - `640x360@60/30`
- YUYV:
  - `640x480@30`
  - `640x360@30`

## Confirmed Audio Controls

The PIXY microphone can be controlled through standard ALSA.

- `Mic Capture Switch`: read/write boolean, used for mute.
- `Mic Capture Volume`: read/write integer `0..10`.

PixyPilot mutes the microphone when entering camera privacy mode. It does not automatically unmute when privacy mode is turned off, because that should remain an explicit user choice.

## Vendor HID Findings

The PIXY exposes a vendor HID interface through `/dev/hidrawN`. Normal users need a udev rule or another permission strategy before writing to it.

Observed HID report shape:

- Report length: 32 bytes
- Report ID: `0x09`
- Payload size: 31 bytes

PixyPilot currently implements the following HID command families from reverse-engineered public work plus local testing.

### Tracking / Privacy

Set command:

```text
09 01 01 00 00 01 00 01 XX
```

Known values for `XX`:

- `00`: off / idle
- `01`: tracking / Auto Follow
- `02`: privacy

Follow-up/query-like command:

```text
09 01 01 01
```

Privacy mode has been observed to darken the camera image. It appears to be an explicit camera state, not just a delayed timer. The auto-privacy delay is separate.

### Auto Privacy Delay

Set command:

```text
09 02 01 00 00 04 00 04 XX
```

Current interpretation:

- `XX` is a timeout in seconds.
- `00` disables the automatic transition.
- This configures a delay, but it does not itself immediately enter privacy mode.

Follow-up/query-like command:

```text
09 02 01 01
```

### Gesture Control

Set command:

```text
09 04 02 00 00 02 00 02 02 XX
```

Known values for `XX`:

- `00`: off
- `01`: on

Follow-up/query-like command:

```text
09 04 02 01 00 01 00 01 02
```

### Audio DSP Mode

Set command:

```text
09 05 00 03 00 01 00 01 XX
```

Known values for `XX`:

- `01`: noise cancel
- `02`: live
- `03`: original

Query-like command:

```text
09 05 00 04
```

## UVC Extension Unit

The PIXY exposes a UVC Extension Unit:

- Unit ID: `2`
- GUID: `46394292-0cd0-4ae3-8783-3133f9eaaa3b`
- Control count: `10`
- Control bitmap indicates selectors `1..10` are present.

Important caveat: this GUID is not enough to identify EMEET-specific meanings by itself. It appears on other devices too. The selectors need to be correlated with official app behavior.

Observed selector metadata:

| Selector | Size | Observed shape |
| --- | ---: | --- |
| 1 | 1 byte | toggle or small mode |
| 2 | 1 byte | toggle or small mode |
| 3 | 2 bytes | value or bitfield |
| 4 | 1 byte | toggle or small mode |
| 5 | 10 bytes | structured payload |
| 6 | 1024 bytes | buffer or mailbox |
| 7 | 1 byte | toggle or small mode |
| 8 | 1 byte | toggle or small mode |
| 9 | 1024 bytes | buffer or mailbox |
| 10 | 12 bytes | structured payload |

Until those controls are mapped, PixyPilot treats UVC extension selectors as investigation data, not normal UI controls.

## Windows USBPcap Baseline

Baseline capture analyzed:

```text
pcaps/01_device_plugin_baseline.pcapng
```

Capture facts:

- Taken on Windows 11 with Dumpcap/Wireshark 4.6.6.
- 365 packets over 8.420025 seconds.
- Descriptor traffic, UVC class-control traffic, and one HID report descriptor response were present.

Useful findings from this baseline:

- Windows sees the same UVC Extension Unit ID `2`.
- Windows sees the same 10 extension selectors.
- The HID descriptor confirms report ID `0x09` with 31-byte input and output payloads.
- Windows issued `SET_CUR` twice for Processing Unit selector `0x05`, value `2`, which sets Power Line Frequency to 60 Hz.

The baseline does not include official EMEET Studio user actions, so it does not reveal the meaning of Auto Framing, Speaker Tracking, presets, or vendor image modes.

## EMEET Studio Launch Idle Capture

Second capture analyzed:

```text
pcaps/02_emeet_studio_launch_idle.pcapng
```

Capture facts:

- Taken on Windows 11 with Dumpcap/Wireshark 4.6.6.
- 3639 packets over 46.940095 seconds.
- Most bytes are video streaming, not control traffic.
- Useful control signal:
  - 44 HID data packets
  - 69 UVC control packets

What EMEET Studio did at launch:

- Queried string descriptors for manufacturer and product:
  - Manufacturer: `EMEET`
  - Product: `EMEET PIXY`
- Queried a serial/build-like string. Public docs should not publish user-specific serial values.
- Set Power Line Frequency to value `2`, matching 60 Hz.
- Read normal UVC control values for image, exposure, focus, PTZ, and white balance.
- Negotiated preview streaming through standard UVC Probe/Commit requests.
- Final observed preview stream:
  - Format Index `1`
  - Frame Index `3`
  - Frame interval `333333`
  - Max frame size `2073600`
  - Max payload transfer size `3072`
  - Based on the descriptor table, this is MJPG `1920x1080@30`.

HID startup/status traffic observed:

| Host query | Observed response pattern | Current interpretation |
| --- | --- | --- |
| `09 01 00 04` | `09 01 00 04 00 02 00 02 04 20...` | Unknown group 1 capability/status query |
| `09 05 00 04` | `09 05 00 04 00 01 00 01 02...` | Audio DSP mode query; value `02` matches Live mode |
| `09 04 00 02` | `09 04 00 02 00 05 00 05 00 00 00 00 00...` | Unknown group 4 status/capability query |
| `09 04 00 07 ... 01/02/04` | responses echo `01`, `02`, or `04` | Possible per-feature status reads inside group 4 |
| `09 04 00 0e`, `09 04 00 0a`, `09 04 00 0c` | one-byte value `00` | Unknown group 4 status reads |
| `09 02 01 01` | `09 02 01 01 00 04 00 04 00...` | Auto-privacy delay/status query; value was `0` in this run |
| `09 01 01 01` | values `03` and `00` seen at different times | Tracking/privacy state query; value `03` still unknown |
| `09 03 01 16 ... 01/02/03` | 14-byte responses echoing sub-value | Unknown group 3 structured status/config |
| `09 03 01 14` | 13-byte zero payload | Unknown group 3 status |
| `09 41 00 04`, `09 61 00 04` | short two-byte values ending in `20` | Unknown capability or version queries |
| `09 01 00 03` | ASCII device/build identifier | Device/build information query |
| `09 03 01 17` | one-byte value `20` | Unknown group 3 status |

Current conclusion from launch-idle:

- EMEET Studio startup gives us useful status queries, but not feature-toggle commands for Auto Framing or Speaker Tracking.
- No clear UVC Extension Unit selector writes were observed during idle startup.
- The next captures must isolate one user action at a time so these startup queries can be separated from real feature commands.

## AF Toggle Capture

Third capture analyzed:

```text
pcaps/03_auto_framing_toggle.pcapng
```

User-reported action:

- The file was originally named as an Auto Framing capture, but the user later clarified this was the AF/autofocus control.
- AF was on at capture start.
- AF was toggled off, then toggled back on.

Observed USB behavior:

- No HID interrupt data packets were decoded in this capture.
- No UVC Extension Unit writes were seen.
- The only meaningful control changes were standard UVC Camera Terminal writes:

| Time | Request | UVC control | Value |
| --- | --- | --- | --- |
| 39.175597s | `SET_CUR` | Camera Terminal entity `0x01`, selector `0x08`, `Focus, Auto` | `0` |
| 39.180864s | `SET_CUR` | Camera Terminal entity `0x01`, selector `0x06`, `Focus Absolute` | `512` |
| 44.631097s | `SET_CUR` | Camera Terminal entity `0x01`, selector `0x08`, `Focus, Auto` | `1` |

Current conclusion:

- This capture maps AF off/on to standard UVC `Focus, Auto`, not to HID.
- Turning the control off also made EMEET Studio write `Focus Absolute = 512`.
- This is not the Smart Pixy Auto Framing command.
- Smart Pixy Auto Framing still needs its own one-action capture.
- PixyPilot already exposes this behavior through Focus Control as `focus_automatic_continuous` plus `focus_absolute`.

## Focus/Metering And Control Captures

Additional captures analyzed:

```text
pcaps/04_focus_metering_modes.pcapng
pcaps/05_standard_tracking_toggle.pcapng
pcaps/06_privacy_toggle.pcapng
```

The EMEET Studio UI has at least two relevant areas:

- Focus/Metering:
  - focus on selected areas
  - focus on central areas
  - human face
- Control:
  - standard tracking
  - privacy

### Control Section

The Control section maps to the known group `0x01` HID command family:

```text
09 01 01 00 00 01 00 01 XX
```

Observed values:

| Value | Meaning |
| --- | --- |
| `00` | off / idle |
| `01` | standard tracking |
| `02` | privacy |

Capture 6 independently confirmed privacy by sending:

```text
09 01 01 00 00 01 00 01 02
```

The status query remains:

```text
09 01 01 01
```

### Focus/Metering Section

The Focus/Metering controls use group `0x04` HID commands.

Observed command pattern:

```text
09 04 00 01 00 05 00 05 XX
09 04 00 03 00 05 00 05 XX
09 04 00 02 ...
```

Confirmed mode values:

| Value | Focus/Metering mode |
| --- | --- |
| `00` | focus on central areas |
| `01` | human face |
| `02` | focus on selected areas |

The status response for the mode query uses the same mode value:

```text
09 04 00 02 00 05 00 05 XX ...
```

Selected-area click behavior:

```text
09 04 00 01 00 05 00 05 02 0f 00 7f 7f ...
09 04 00 02 00 05 00 05 02 0f 00 7f 7f ...
```

Current interpretation of selected-area payload:

- Bytes after the mode value appear to carry a selected point or region.
- One observed click produced `0f 00 7f 7f`.
- Coordinate scaling and origin are not decoded yet.
- The three named modes are safe to expose, but arbitrary selected-area clicking should remain experimental until more known-position clicks are captured.

## Known Gaps

These features are not fully decoded yet:

- Auto Framing as a distinct feature from Auto Follow
- Speaker Tracking
- Official-app presets
- Native AF trigger and AF lock behavior
- Native UVC relative zoom behavior
- Names and payloads for UVC extension selectors `1..10`
- Whether some smart features use HID, UVC extension selectors, or both

## Capture Plan

To decode missing behavior, capture one official-app action at a time. Start USBPcap/Wireshark, perform exactly one change, wait a few seconds, stop the capture, and save a clearly named file.

Recommended sequence:

1. Launch EMEET Studio and make no setting changes.
2. Toggle Auto Framing off/on.
3. Toggle Auto Follow off/on.
4. Toggle Speaker Tracking off/on.
5. Toggle Privacy off/on.
6. Toggle Gesture Control off/on.
7. Change each audio DSP mode once.
8. Trigger AF or focus-lock actions if exposed by the official app.
9. Change one image-control preset or value at a time.
10. Change one video format, resolution, or FPS option at a time.

Local packet captures are intentionally ignored by git. Record findings in markdown, but keep raw captures private unless there is a clear reason to publish them.
