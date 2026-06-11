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
| `pcaps/imports/2026-06-11T174057Z-2aa35af79bbc-31.pcapng` | Assistance tab Focus/Metering modes | Reconfirmed group `04` Focus/Metering mode values: Human Face `01`, Center `00`, Selected Area `02`. Selecting Selected Area without a preview click sent coordinates `00 00`; clicked points still use explicit X/Y coordinates. |
| `pcaps/29.pcapng` | Control tab dropdown: Tracking Mode, Privacy Mode, Standard Mode | Cleanly confirmed the official dropdown maps to group `01`: Standard `00`, Tracking `01`, Privacy `02`. Also repeated group `02` status responses `... 03` after Privacy and `... 00` after Standard. |
| `pcaps/30.pcapng` | Standard Mode, Assistance tab Auto-Enter Privacy enabled, delay set to 10s, then waited | Only the group `02` 10-second delay write/readback was observed. No group `01` privacy command and no `09 02 00 02` status transition appeared during the 42-second capture; the camera did not enter privacy. |
| `pcaps/imports/2026-06-11T185619Z-c0ac17cbf7c0-32.pcapng` | Resolution changes: 4K, 2K, 1080p60, 1080p30, 720p30 | Reconfirmed standard UVC Probe/Commit only. No vendor HID or UVC Extension Unit command was observed for the resolution picker. |

## HID Report Layouts

## Cross-Check: LarsArtmann/emeet-pixyd

On 2026-06-10 we reviewed the public `LarsArtmann/emeet-pixyd` repository:

https://github.com/LarsArtmann/emeet-pixyd

Relevant findings:

- It independently confirms the same core HID groups PixyPilot already uses for tracking/privacy (`01`), gesture (`04`), and audio DSP mode (`05`).
- It uses the same 9-byte config reports and 4-byte commit/query reports that PixyPilot captured from EMEET Studio.
- It waits roughly `200ms` between the config report and commit report for the core tracking/audio/gesture commands. PixyPilot currently keeps the HID report gap configurable through `hid.report_gap_ms` and defaults to a lower-latency value.
- It implements HID state queries and response parsing for tracking, audio, and gesture. PixyPilot now has a backend state-query endpoint based on the same query reports.
- It does not appear to include the later PixyPilot-specific captures for focus/metering selected area, mirror/flip, auto-rotate, auto-privacy delay, HID PTZ vector movement, or native PTZ preset save/load.

Live PixyPilot check on the connected camera:

- Audio query `09 05 00 04` decoded successfully.
- Gesture query `09 04 02 01 00 01 00 01 02` decoded successfully.
- Tracking query `09 01 01 01` returned group `01` value `03`, which remains unresolved. PixyPilot intentionally does not map `03` to Standard, Tracking, or Privacy until a capture proves the meaning.

PixyPilot endpoint:

```text
GET /api/pixy-hid/state
GET /api/pixy-hid/queries
GET /api/pixy-hid/query/{query_name}
POST /api/pixy-hid/diagnostics/capture?save=false
POST /api/pixy-hid/diagnostics/capture?save=true
```

These endpoints are read-only and return decoded fields when the camera response is known. They also return raw value bytes, set-bit indexes, full request/response hex, and an ASCII preview so unresolved responses can be documented without guessing.

The web UI exposes the same flow in the `HID Diagnostics` panel:

- `Capture` reads the current whitelisted queries and displays them in the page.
- `Save` reads the same queries and writes a timestamped JSON snapshot under `diagnostics/hid/`.
- `Copy` copies the current snapshot JSON for sharing.
- `Download` saves the current snapshot through the browser.
- `ASCII` shows a printable response preview. Binary/control bytes are rendered as `.` so text fragments such as device/build identifiers stand out.

PixyPilot also appends a rolling HID trace to:

```text
diagnostics/hid/pixypilot-hid-trace.jsonl
```

Each line is one JSON event. Command writes include the operation name, hidraw path, report index, and request hex. Query events include the operation/query name, request hex, response hex, raw value, raw bit indexes, and ASCII previews when available. This file is intended for decoding ambiguous states such as unknown tracking bitfields because it keeps the exact command sequence and readbacks together in timestamp order.

`diagnostics/` is intentionally gitignored because snapshots and traces can include device state and identifiers.

## Cross-Check: RoseWaveStudio/PixyBar

On 2026-06-11 we reviewed the public `RoseWaveStudio/PixyBar` repository:

https://github.com/RoseWaveStudio/PixyBar

Relevant findings:

- It independently controls the PIXY over macOS IOKit HID, with no EMEET binaries.
- It identifies the PIXY USB ID as VID `0x328f`, PID `0x00c0`.
- It prefers the HID interface whose usage page and usage are both `0x83`. PixyPilot now prefers Linux hidraw nodes whose report descriptor advertises the same usage pair.
- It masks the response group byte with `0x1f` before matching HID responses. PixyPilot now does the same in decoded response parsing.
- It documents target-tracking modes through group `04`, command `01`: off, face, half-body, and full-body.
- It documents degree-based PTZ relative and absolute motor commands through group `03`, commands `19` and `18`.
- Its README notes that AI tracking visibly follows only while another app has the camera video stream open.

PixyPilot keeps the EMEET Studio preset-load command separate from PixyBar's absolute motor command. Both use header `09 03 01 18`, but the payload length differs: one-byte slot loads use `00 01 00 01 SS`, while absolute motor positioning uses `00 05 00 05 AX` plus a float32 degree value.

## Cross-Check: nick0413/Emeet_pixy_for_linux

On 2026-06-11 we reviewed the public `nick0413/Emeet_pixy_for_linux` repository:

https://github.com/nick0413/Emeet_pixy_for_linux

Relevant findings:

- It is a small Tkinter UI plus shell helper that wraps `v4l2-ctl` and direct hidraw writes.
- It independently confirms the same HID tracking/privacy, gesture, audio mode, and auto-privacy command families already implemented by PixyPilot.
- It uses standard V4L2 controls for PTZ, zoom, image controls, focus, exposure, and anti-flicker.
- It does not include decoded vendor UVC Extension Unit selectors.
- Its UI makes auto/manual parent controls prominent beside dependent sliders. PixyPilot now mirrors that lesson by showing explicit unlock actions for inactive exposure, white-balance, and focus controls.

Whitelisted diagnostic query names:

| Query name | HID query report | Current purpose |
| --- | --- | --- |
| `tracking_state` | `09 01 01 01` | Tracking/privacy status. |
| `target_tracking_state` | `09 04 01 01` | Target-tracking mode and normalized float payload. |
| `tracking_capability` | `09 01 00 04` | Unknown group 1 capability/status response. |
| `tracking_probe_0100` | `09 01 01 00` | Experimental group 1 read probe for Standard/Tracking correlation. |
| `tracking_probe_0102` | `09 01 01 02` | Experimental group 1 read probe for Standard/Tracking correlation. |
| `tracking_probe_0103` | `09 01 01 03` | Experimental group 1 read probe for Standard/Tracking correlation. |
| `tracking_probe_0104` | `09 01 01 04` | Experimental group 1 read probe for Standard/Tracking correlation. |
| `device_info` | `09 01 00 03` | ASCII device/build identifier. |
| `audio_state` | `09 05 00 04` | Audio DSP mode status. |
| `gesture_state` | `09 04 02 01 00 01 00 01 02` | Gesture-control status. |
| `auto_privacy_state` | `09 02 01 01` | Auto-privacy delay/status. |
| `focus_metering_state` | `09 04 00 02` | Focus/metering mode and selected-area coordinates. |
| `mirror_horizontal_state` | `09 04 00 07 00 01 00 01 01` | Horizontal mirror state. |
| `mirror_vertical_state` | `09 04 00 07 00 01 00 01 02` | Vertical mirror state. |
| `auto_rotate_state` | `09 04 00 07 00 01 00 01 04` | Auto-rotate state. |

Live check on 2026-06-10 after adding diagnostic locking:

| Query | Response | Notes |
| --- | --- | --- |
| `tracking_state` | `09 01 01 01 00 01 00 01 03 ...` | Value `03`, set bits `[0, 1]`. Confirmed non-privacy, but not safely decoded as Standard or Tracking. |
| `tracking_capability` | `09 01 00 04 00 02 00 02 04 20 ...` | Value `04`, set bits `[2]`; byte `09` was `20`. Meaning unknown. |
| `device_info` | `09 01 00 03 00 0c 00 0c 32 35 30 35 32 34 36 30 31 30 31 33 ...` | ASCII payload `250524601013`. |
| `audio_state` | `09 05 00 04 00 01 00 01 02 ...` | Value `02`, decoded as Live. |
| `gesture_state` | `09 04 02 01 00 02 00 02 02 01 ...` | Value `01`, decoded as enabled. |
| `auto_privacy_state` | `09 02 01 01 00 04 00 04 00 00 00 00 ...` | Timeout/status value `0` in this run. |
| `focus_metering_state` | `09 04 00 02 00 05 00 05 00 38 38 7f 7f ...` | Mode byte `00`; selected-area default coordinates still visible in the response. |

PixyPilot serializes HID read/write access and drains stale hidraw input before each diagnostic query. This is required because concurrent hidraw requests can otherwise read another request's response.

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

Response matching caveat: some responses can set high bits in the group byte. PixyPilot compares response group as `response[1] & 0x1f` before decoding.

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

Important readback caveat: the command values above are confirmed for host-to-camera SET reports. The readback query `09 01 01 01` is not a direct echo of those command values. Local snapshots confirmed:

| Readback value | Current interpretation |
| --- | --- |
| `00` | Standard / idle |
| `01` | Tracking |
| `02` | Privacy |
| `03` | Non-privacy; Standard vs Tracking unknown |

PixyPilot decodes `00`, `01`, and `02` directly. Value `03` remains intentionally undecoded because it appears to be a combined or secondary status value rather than a clean Standard/Tracking/Privacy enum.

### Group `04`: Target Tracking

PixyBar identified a separate target-tracking family that sits under group `04`, command `01`. PixyPilot now exposes this as Target Tracking.

Set target tracking:

```text
09 04 01 00 00 0d 00 0d MM XX XX XX XX YY YY YY YY SS SS SS SS
```

Query target tracking:

```text
09 04 01 01
```

Observed mode values from PixyBar and Linux HID probing:

| `MM` | Experimental label |
| --- | --- |
| `00` | Off |
| `01` | Face |
| `02` | Half-body |
| `03` | Full-body |

The three float32 little-endian values are normalized target parameters. PixyBar uses `0.5`, `0.5`, and `1.0` as defaults. EMEET Studio does not expose Face/Half/Full controls with these names, so PixyPilot keeps this command family as diagnostic/reverse-engineering data instead of presenting it as a confirmed main UI feature.

Focused Linux test on 2026-06-11:

| User action | Sent mode | Readback result |
| --- | --- | --- |
| Experimental target Off | `00` | Tracking readback became Standard `00`; target readback became Off `00`. In the UI this should be represented by Control Mode Standard, not as a separate target button. |
| Control Mode Tracking | group `01` Tracking `01` | Tracking readback became `01`; target readback returned Face `01`, suggesting Face is the device/default target when tracking is enabled. |
| Experimental target Half | `02` | Target readback became Half-body `02`. |
| Experimental target Full | `03` | Target readback returned Face `01` on two attempts. Full-body is therefore not confirmed on the current Linux HID path/firmware. |

For user-facing controls, PixyPilot maps the Windows Focus/Metering behavior to Focus Control: `Center`, `Face`, and `Region`. Region selection sends the confirmed selected-area focus command with X/Y coordinates and gives the preview a rectangular region overlay.

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

### Group `03`: Degree-Based PTZ Motors

PixyBar identified direct motor movement commands that use degree float payloads.

Relative movement:

```text
09 03 01 19 00 05 00 05 AX DD DD DD DD
```

Absolute movement:

```text
09 03 01 18 00 05 00 05 AX DD DD DD DD
```

Known axis values:

| `AX` | Axis |
| --- | --- |
| `01` | Pan |
| `02` | Tilt |

For relative movement, PixyPilot uses the PixyBar sign mapping:

| Direction | Axis | Float delta |
| --- | --- | ---: |
| Left | `01` | negative degrees |
| Right | `01` | positive degrees |
| Up | `02` | positive degrees |
| Down | `02` | negative degrees |

Recenter/Home is implemented as two absolute writes: pan `0.0`, then tilt `0.0`.

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

The imported 2026-06-11 Focus/Metering capture reconfirmed the mode writes from the official Assistance tab:

| Official UI action | SET payload | Status payload |
| --- | --- | --- |
| Human Face | `01 00 00 7f 7f` | `01 00 00 7f 7f` |
| Center Area | `00 00 00 7f 7f` | `00 00 00 7f 7f` |
| Selected Area, no clicked point | `02 00 00 7f 7f` | `02 00 00 7f 7f` |

This means `00 00` can be either the top-left selected-area point or the default payload emitted when Selected Area is chosen before the user clicks a point in the preview.

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

Focused resolution capture `pcaps/imports/2026-06-11T185619Z-c0ac17cbf7c0-32.pcapng` reconfirmed these official-app labels:

| EMEET Studio label | UVC format index | UVC frame index | Frame interval | Linux format |
| --- | ---: | ---: | ---: | --- |
| 4K | `1` | `1` | `333333` | `MJPG 3840x2160@30` |
| 2K | `1` | `2` | `333333` | `MJPG 2560x1440@30` |
| 1080P 60FPS | `1` | `3` | `166666` | `MJPG 1920x1080@60` |
| 1080P 30FPS | `1` | `3` | `333333` | `MJPG 1920x1080@30` |
| 720P 30FPS | `1` | `5` | `333333` | `MJPG 1280x720@30` |

Each resolution change stopped streaming on VideoStreaming interface alternate setting `0`, performed Probe/Commit, then restarted streaming on alternate setting `11`.

PixyPilot handles this through Linux V4L2 rather than raw userspace USB. The `uvcvideo` kernel driver translates `VIDIOC_S_FMT` and `VIDIOC_S_PARM` calls on `/dev/videoN` into the UVC Probe/Commit USB control flow. PixyPilot preserves the enumerated frame interval in 100 ns units, uses that exact interval when setting preview/recording formats, and returns the driver's `VIDIOC_G_FMT`/`VIDIOC_G_PARM` readback after a format change.

## Still Unknown

- UVC Extension Unit selector meanings for selectors `1..10`.
- Whether any smart behavior requires both HID state and UVC Extension Unit state.
- Official-app preset delete/default behavior.
- Whether UVC relative zoom can be useful on Linux despite `zoom_continuous` exposing as a no-op.
- Whether there is a distinct sound-following/speaker-tracking command. No official-app control for this has been found yet.
