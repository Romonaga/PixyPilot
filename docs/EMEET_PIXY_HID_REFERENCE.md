# EMEET PIXY Packet Capture And HID Reference

This document is the compact reference for the EMEET PIXY captures and decoded HID commands used by PixyPilot. The longer narrative is in [EMEET_PIXY_REVERSE_ENGINEERING.md](EMEET_PIXY_REVERSE_ENGINEERING.md).

Unless noted otherwise, HID reports are 32 bytes, start with report ID `09`, and are padded with trailing `00` bytes to 32 bytes.

## Packet Capture Index

Raw packet captures are local working files and are not committed to git. The important decoded findings are recorded here.

| Capture | User action | Confirmed result |
| --- | --- | --- |
| `pcaps/01_device_plugin_baseline.pcapng` | Device plugged in / baseline enumeration | USB ID `328f:00c0`; UVC Extension Unit ID `2`; 10 vendor UVC selectors; HID report ID `09` with 31-byte input/output payloads; Windows set anti-flicker to 60 Hz through standard UVC Processing Unit selector `0x05`. |
| `pcaps/02_emeet_studio_launch_idle.pcapng` | Launch EMEET Studio and idle | Startup/status traffic only; queried HID groups `01`, `02`, `03`, `04`, `05`, `41`, and `61`; final preview was MJPG `1920x1080@30`; no decoded user-action command. |
| `pcaps/03_auto_framing_toggle.pcapng` | AF/autofocus off, then on | Standard UVC only: `Focus, Auto` selector `0x08` changed `1 -> 0 -> 1`; Studio wrote `Focus Absolute = 512` after disabling AF. |
| `pcaps/04_focus_metering_modes.pcapng` | Focus/Metering and Control area activity | Mixed HID traffic. Helped identify group `01` tracking/privacy and group `04` focus/metering patterns. |
| `pcaps/05_standard_tracking_toggle.pcapng` | Standard tracking toggle, with accidental privacy | Group `04` focus/metering traffic plus group `01` state traffic. Later captures clarified the exact mapping. |
| `pcaps/06_privacy_toggle.pcapng` | Privacy toggle | Confirmed explicit privacy command `09 01 01 00 00 01 00 01 02` and status query `09 01 01 01`. |
| `pcaps/07_metering_selected_area.pcapng` | Focus on selected area and click preview | Confirmed Focus/Metering mode value `02`; selected-area payload uses X/Y coordinates followed by `7f 7f`. |
| `pcaps/08_metering_center_area.pcapng` | Focus on central areas | Confirmed Focus/Metering mode value `00`. |
| `pcaps/09_metering_human_face.pcapng` | Human face focus | Confirmed Focus/Metering mode value `01`. |
| `pcaps/10-focusareas.pcapng` | Click top-left, top-right, bottom-left, bottom-right, center | Confirmed selected-area coordinate range is `00..7f`, origin top-left; center observed as `38 38`. |
| `pcaps/11-autoprivacy.pcapng` | Auto-entry privacy: 10s, 1m, 15m, never | Confirmed group `02` auto-privacy delay command with a 32-bit little-endian seconds value. |
| `pcaps/12-on off gesture and rotate.pcapng` | Gesture on/off; Auto Rotate on/off | Confirmed gesture command and auto-rotate feature toggle command. |
| `pcaps/13 video res.pcapng` | 2K, 4K, 1080p60, 1080p30, 720p30 | Standard UVC Probe/Commit only; no HID or UVC Extension Unit command required for video format selection. |
| `pcaps/14 audio mode.pcapng` | Audio mode Live, NC, Original | Confirmed group `05` audio DSP mode values: NC `01`, Live `02`, Original `03`. |
| `pcaps/15.pcapng` | Effects: Bright, Nostalgia, Blue, Cold, Vivid, Default | Standard UVC Processing Unit writes only; effects are image-control presets, not HID. |
| `pcaps/16.pcapng` | Anti-flicker 50 Hz, then 60 Hz | Standard UVC Processing Unit selector `0x05`; values `1` and `2`. |
| `pcaps/17.pcapng` | Flip vertical, then horizontal | Confirmed group `04` feature toggles: vertical feature `02`, horizontal feature `01`. |
| `pcaps/18.pcapng` | Monitor/listen on; slider 100 -> 0 -> 100 | USB Audio streaming setup at 48 kHz; no HID or camera-side control for the monitor slider. |
| `pcaps/19.pcapng` | Follow mode then record | Recording negotiated MJPG `1280x720@30`; group `01` status showed tracking active; no new follow SET command. |
| `pcaps/20.pcapng` | Manual 90-degree rotate left/right/restore | No camera-side HID, UVC, UVC-extension, or audio control after enumeration; likely app-local transform. |
| `pcaps/21.pcapng` | PTZ arrow pad: left/right/up/down | Confirmed directional HID jog command `09 63 01 19 ...`. |
| `pcaps/22.pcapng` | Circular PTZ control movement | Confirmed vector HID command `09 63 01 20 ...` with three little-endian float32 values. |
| `pcaps/23.pcapng` | Zoom far -> near -> far | Standard UVC `Zoom Absolute`; values `100` far and `150` near. |
| `pcaps/24.pcapng` | Save PTZ presets 1, 2, 3 | Confirmed HID preset save command `09 03 01 15 ...` and preset query `09 03 01 16 ...`. |
| `pcaps/25.pcapng` | Load default, then presets 1, 2, 3 | Confirmed HID preset load command `09 03 01 18 ...`; Studio separately restored zoom through standard UVC `Zoom Absolute`. |
| `pcaps/26.pcapng` | Unknown official app control `1x -> 2x -> 1x` | No camera-side command; likely app-local preview scaling/crop. |
| `pcaps/27.pcapng` | Custom image controls: brightness, contrast, EV, ISO, sharpness, saturation, tone, AWB, WB | Standard UVC image/exposure controls only; no HID or UVC Extension Unit command. |
| `pcaps/28.pcapng` | Privacy-related settings scattered through EMEET Studio | Reconfirmed auto-privacy delay writes and explicit group `01` tracking/privacy writes. After a 10s delay write, no later immediate privacy write was observed before the next delay write. Also observed group `02` status responses `09 02 00 02 ... 03` while privacy was active and `... 00` after returning to tracking/off; meaning is not confirmed. |
| `pcaps/29.pcapng` | Control tab dropdown: Tracking Mode, Privacy Mode, Standard Mode | Cleanly confirmed the official dropdown maps to group `01`: Standard `00`, Tracking `01`, Privacy `02`. Also repeated group `02` status responses `... 03` after Privacy and `... 00` after Standard. |
| `pcaps/30.pcapng` | Standard Mode, Assistance tab Auto-Enter Privacy enabled, delay set to 10s, then waited | Only the group `02` 10-second delay write/readback was observed. No group `01` privacy command and no `09 02 00 02` status transition appeared during the 42-second capture; the camera did not enter privacy. |

## HID Report Layouts

### Common Framing

All known reports use this outer shape:

```text
09 GG AA BB CC LL 00 LL ...
```

Known fields:

| Offset | Meaning |
| ---: | --- |
| `0` | Report ID, always `09`. |
| `1` | Command group. Known groups include `01`, `02`, `03`, `04`, `05`, and `63`. |
| `2..3` | Group-specific command or subcommand. |
| `4` | Usually `00` in confirmed host SET reports. |
| `5` | Payload length in bytes for many reports. |
| `6` | Usually `00`. |
| `7` | Repeated payload length for many reports. |
| `8..` | Group-specific payload. |
| Remaining bytes | Zero padding to 32 bytes. |

Some query/status reports are shorter, such as `09 01 01 01` and `09 05 00 04`. PixyPilot still pads them to 32 bytes when writing to hidraw.

### Group `01`: Tracking And Privacy

Set state:

```text
09 01 01 00 00 01 00 01 XX
```

Query/status:

```text
09 01 01 01
```

Known state values:

| `XX` | Meaning |
| --- | --- |
| `00` | Standard Mode / idle |
| `01` | Tracking Mode / Auto Follow |
| `02` | Privacy |

Capture `pcaps/29.pcapng` confirmed these labels directly from the EMEET Studio Control tab dropdown by cycling Tracking Mode -> Privacy Mode -> Standard Mode.

### Group `02`: Auto Privacy Delay

Set delay:

```text
09 02 01 00 00 04 00 04 TT TT TT TT
```

Query/status:

```text
09 02 01 01
```

`TT TT TT TT` is a 32-bit little-endian timeout in seconds. `00 00 00 00` means Never/disabled.

Capture `pcaps/28.pcapng` adds two important observations:

- Repeated `10s` delay writes were acknowledged by the camera, but the capture did not show EMEET Studio later sending the explicit privacy command `09 01 01 00 00 01 00 01 02` as a simple 10-second software timer.
- Device-to-host responses matching `09 02 00 02 00 01 00 01 XX` appeared with `XX=03` while privacy was active and `XX=00` after returning to tracking/off. This may be a related auto-privacy/status field, but it is not decoded yet.

Capture `pcaps/30.pcapng` isolated Standard Mode plus Assistance-tab Auto-Enter Privacy enabled with a 10-second delay. The only HID traffic was:

```text
09 02 01 00 00 04 00 04 0a 00 00 00
09 02 01 01
```

No automatic privacy transition occurred in the capture. This means PixyPilot should not present the delay write as a working automatic privacy feature until the missing trigger condition is found.

### Group `03`: PTZ Presets

Save slot:

```text
09 03 01 15 00 02 00 02 SS 01
```

Query slot:

```text
09 03 01 16 00 01 00 01 SS
```

Load slot:

```text
09 03 01 18 00 01 00 01 SS
```

`SS` is a 1-based preset slot. PixyPilot currently supports slots `01`, `02`, and `03`, matching the official app captures.

Observed query response shape:

```text
09 03 01 16 00 0e 00 0e SS EE XX XX XX XX YY YY YY YY ZZ ZZ ZZ ZZ
```

Known response fields:

| Field | Meaning |
| --- | --- |
| `SS` | Slot number |
| `EE` | Saved/enabled byte, observed `01` for saved slots |
| `XX XX XX XX` | little-endian float32 PTZ X |
| `YY YY YY YY` | little-endian float32 PTZ Y |
| `ZZ ZZ ZZ ZZ` | little-endian float32 PTZ Z, observed `0.0` |

### Group `04`: Gesture, Feature Toggles, And Focus/Metering

Gesture control:

```text
09 04 02 00 00 02 00 02 02 XX
09 04 02 01 00 01 00 01 02
```

Known gesture values:

| `XX` | Meaning |
| --- | --- |
| `00` | Off |
| `01` | On |

Feature toggle:

```text
09 04 00 08 00 02 00 02 FF XX
09 04 00 07 00 01 00 01 FF
```

Known feature IDs:

| `FF` | Feature |
| --- | --- |
| `01` | Horizontal flip |
| `02` | Vertical flip |
| `04` | Auto Rotate When Upside Down |

Known feature values:

| `XX` | Meaning |
| --- | --- |
| `00` | Off |
| `01` | On |

Focus/Metering mode set:

```text
09 04 00 01 00 05 00 05 MM XX YY 7f 7f
09 04 00 03 00 05 00 05 MM XX YY 7f 7f
09 04 00 02
```

Known mode values:

| `MM` | Mode |
| --- | --- |
| `00` | Focus on central areas |
| `01` | Human face |
| `02` | Focus on selected area |

For selected area, `XX` and `YY` are the focus point coordinates in an observed `00..7f` range with origin at top-left. The final two bytes were always observed as `7f 7f`; their exact meaning is not yet decoded.

Known selected-area points:

| Preview point | Payload |
| --- | --- |
| top-left | `02 00 00 7f 7f` |
| top-right | `02 7f 00 7f 7f` |
| bottom-left | `02 00 7f 7f 7f` |
| bottom-right | `02 7f 7f 7f 7f` |
| center-ish | `02 38 38 7f 7f` |

### Group `05`: Audio DSP Mode

Set mode:

```text
09 05 00 03 00 01 00 01 XX
```

Query/status:

```text
09 05 00 04
```

Known mode values:

| `XX` | EMEET Studio label | PixyPilot label |
| --- | --- | --- |
| `01` | NC | Noise cancel |
| `02` | Live | Live |
| `03` | Original | Original |

### Group `63`: PTZ Movement

Directional jog:

```text
09 63 01 19 00 05 00 05 AX DD DD DD DD
```

Known fields:

| Field | Meaning |
| --- | --- |
| `AX` | Axis: `01` pan, `02` tilt |
| `DD DD DD DD` | little-endian float32 delta |

Known direction mapping:

| Direction | Axis | Delta bytes | Float |
| --- | --- | --- | ---: |
| Left | `01` | `00 00 80 3f` | `+1.0` |
| Right | `01` | `00 00 80 bf` | `-1.0` |
| Up | `02` | `00 00 80 3f` | `+1.0` |
| Down | `02` | `00 00 80 bf` | `-1.0` |

Circular/vector movement:

```text
09 63 01 20 00 0c 00 0c XX XX XX XX YY YY YY YY ZZ ZZ ZZ ZZ
```

The 12-byte payload is three little-endian float32 values: X, Y, Z. In the official app capture, X/Y ranged roughly `-30.0..+30.0` and Z stayed `0.0`. A zero vector is the stop/release report.

## Confirmed Commands

These are the commands PixyPilot currently treats as confirmed and implements.

| Feature | Report bytes | Values |
| --- | --- | --- |
| Standard Mode | `09 01 01 00 00 01 00 01 00` then `09 01 01 01` | Sets the Control tab mode to Standard/idle. |
| Tracking Mode / Auto Follow | `09 01 01 00 00 01 00 01 01` then `09 01 01 01` | Enables tracking/follow state. |
| Privacy Mode | `09 01 01 00 00 01 00 01 02` then `09 01 01 01` | Enters camera privacy state; observed to darken the image. PixyPilot also mutes the mic at the app layer when privacy is enabled. |
| Auto privacy delay | `09 02 01 00 00 04 00 04 TT TT TT TT` then `09 02 01 01` | `TT` is little-endian seconds: Never `00 00 00 00`, 10s `0a 00 00 00`, 1m `3c 00 00 00`, 15m `84 03 00 00`. The write is confirmed, but the camera-side trigger condition is not confirmed. Treat as experimental. |
| Gesture off/on | `09 04 02 00 00 02 00 02 02 XX` then `09 04 02 01 00 01 00 01 02` | `XX`: off `00`, on `01`. |
| Auto Rotate off/on | `09 04 00 08 00 02 00 02 04 XX` then `09 04 00 07 00 01 00 01 04` | `XX`: off `00`, on `01`. |
| Horizontal flip off/on | `09 04 00 08 00 02 00 02 01 XX` then `09 04 00 07 00 01 00 01 01` | `XX`: off `00`, on `01`. |
| Vertical flip off/on | `09 04 00 08 00 02 00 02 02 XX` then `09 04 00 07 00 01 00 01 02` | `XX`: off `00`, on `01`. |
| Focus on central areas | `09 04 00 01 00 05 00 05 00 00 00 7f 7f`, `09 04 00 03 00 05 00 05 00 00 00 7f 7f`, `09 04 00 02` | Focus/Metering mode `00`. |
| Focus on human face | `09 04 00 01 00 05 00 05 01 00 00 7f 7f`, `09 04 00 03 00 05 00 05 01 00 00 7f 7f`, `09 04 00 02` | Focus/Metering mode `01`. |
| Focus on selected area | `09 04 00 01 00 05 00 05 02 XX YY 7f 7f`, `09 04 00 03 00 05 00 05 02 XX YY 7f 7f`, `09 04 00 02` | `XX`/`YY` are selected-area coordinates. PixyPilot currently sends the captured center-ish `38 38` unless explicit coordinates are provided. |
| Audio NC | `09 05 00 03 00 01 00 01 01` then `09 05 00 04` | Noise cancellation mode. |
| Audio Live | `09 05 00 03 00 01 00 01 02` then `09 05 00 04` | Live mode. |
| Audio Original | `09 05 00 03 00 01 00 01 03` then `09 05 00 04` | Original mode. |
| PTZ jog left | `09 63 01 19 00 05 00 05 01 00 00 80 3f` | Pan axis, delta `+1.0`. |
| PTZ jog right | `09 63 01 19 00 05 00 05 01 00 00 80 bf` | Pan axis, delta `-1.0`. |
| PTZ jog up | `09 63 01 19 00 05 00 05 02 00 00 80 3f` | Tilt axis, delta `+1.0`. |
| PTZ jog down | `09 63 01 19 00 05 00 05 02 00 00 80 bf` | Tilt axis, delta `-1.0`. |
| PTZ vector | `09 63 01 20 00 0c 00 0c <x:f32le> <y:f32le> <z:f32le>` | Circular control movement. Send zero vector to stop. |
| Save PTZ preset slot | `09 03 01 15 00 02 00 02 SS 01` then `09 03 01 16 00 01 00 01 SS` | `SS` is slot `01..03`. |
| Load PTZ preset slot | `09 03 01 18 00 01 00 01 SS` | `SS` is slot `01..03`. |

## Confirmed Non-HID Behavior

These official-app behaviors were captured and confirmed not to need HID commands:

| Feature | Path |
| --- | --- |
| Video format picker | Standard UVC Probe/Commit; PixyPilot applies via native V4L2 `VIDIOC_S_FMT` and `VIDIOC_S_PARM`. |
| Zoom far/near | Standard UVC `Zoom Absolute`; Linux V4L2 `zoom_absolute`, range `100..150`. |
| AF/autofocus toggle | Standard UVC `Focus, Auto`; Linux V4L2 `focus_automatic_continuous`. |
| Manual focus | Standard UVC `Focus Absolute`; Linux V4L2 `focus_absolute`. |
| Effects presets | Standard UVC Processing Unit writes. |
| Custom image controls | Standard UVC image/exposure controls. |
| Anti-flicker | Standard UVC `Power Line Frequency`; Linux V4L2 `power_line_frequency`. |
| Mic mute | Standard USB Audio / ALSA `Mic Capture Switch`. |
| Monitor/listen | USB Audio streaming setup plus app-local playback; no decoded camera-side command. |
| Manual 90-degree rotate | No camera-side command observed; likely app-local transform. |
| `1x..2x` unknown control | No camera-side command observed; likely app-local preview scaling/crop. |

## Still Unknown

- UVC Extension Unit selector meanings for selectors `1..10`.
- Whether any smart behavior requires both HID state and UVC Extension Unit state.
- Official-app preset delete/default behavior.
- Whether UVC relative zoom can be useful on Linux despite `zoom_continuous` exposing as a no-op.
- Whether there is a distinct sound-following/speaker-tracking command. No official-app control for this has been found yet.
