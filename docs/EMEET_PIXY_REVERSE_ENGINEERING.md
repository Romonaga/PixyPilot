# EMEET PIXY Linux Reverse Engineering

This document records what PixyPilot has learned about the EMEET PIXY camera so other Linux users can benefit from the work. It separates confirmed behavior from working hypotheses. Do not write arbitrary values to vendor controls unless the command has been correlated with official app behavior or tested safely.

For a compact packet-capture index, HID report layouts, and confirmed command catalog, see [EMEET_PIXY_HID_REFERENCE.md](EMEET_PIXY_HID_REFERENCE.md).

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

The PIXY currently exposes several useful control paths.

| Path | Status | Purpose |
| --- | --- | --- |
| V4L2/UVC | Confirmed | Standard image, focus, exposure, PTZ, and format controls. PixyPilot uses native Linux V4L2 ioctls for inspection, enumeration, control writes, and format switching. |
| ALSA | Confirmed | Microphone mute and microphone capture volume |
| Vendor HID | Partially decoded | Smart features, focus metering, mirror/rotate, PTZ jog/vector movement, native PTZ presets, privacy, gesture, and audio DSP modes |
| UVC Extension Unit | Present, not decoded | Ten vendor selectors exposed through UVC, names still unknown |

## Related Linux Work

PixyPilot has been cross-checked against these public EMEET PIXY references:

- `rm1138` gist: early HID/V4L2 notes that helped identify the device's two main Linux control paths.
- `LarsArtmann/emeet-pixyd`: a Go daemon focused on automatic call detection, tracking/privacy automation, audio switching, and an HTMX web UI.
- `RoseWaveStudio/PixyBar`: a macOS menu-bar app and C `pixyctl` helper that controls the PIXY through IOKit HID.
- `nick0413/Emeet_pixy_for_linux`: a Tkinter and shell-script Linux UI using `v4l2-ctl` plus direct hidraw writes.

`emeet-pixyd` independently validates the same core tracking/privacy, gesture, and audio HID command families that PixyPilot uses. Its most useful additional lesson is operational rather than new command coverage: it queries HID state and waits about `200ms` between core HID config and commit reports. PixyPilot now exposes a read-only HID state query endpoint and keeps the report gap configurable through YAML.

The project did not reveal additional decoded smart-camera commands beyond PixyPilot's current capture set. PixyPilot currently has broader decoded coverage for focus/metering, mirror/flip, auto-rotate, auto-privacy delay, HID PTZ vector movement, and native PTZ preset save/load.

`PixyBar` added useful independent coverage outside the Windows captures. It confirms that target tracking has a separate group `04`, command `01` family with off/face/half-body/full-body modes, and that PTZ can be driven with group `03` degree-based relative and absolute motor commands. It also masks HID response group bytes with `0x1f`, which PixyPilot now mirrors when parsing responses. PixyBar's README also matches local testing: AI tracking visibly follows only while another app has the video stream open.

`Emeet_pixy_for_linux` did not reveal new UVC extension selector mappings. It independently confirms the standard V4L2 plus vendor HID split and uses the same core HID commands for tracking/privacy, gesture, audio mode, and auto-privacy. Its main product lesson is UI clarity: dependent controls should make the auto/manual parent obvious. PixyPilot exposes dependency hints and one-click unlock actions for inactive exposure, white-balance, and focus sliders.

## PixyPilot Implementation Status

Current implementation status:

- V4L2 device inspection, control enumeration, format enumeration, control writes, and format switching use native Linux ioctls.
- MJPG live preview uses native V4L2 mmap capture and has been validated across the advertised MJPG format matrix.
- YUYV/raw preview still uses `ffmpeg` as a fallback because browser preview requires JPEG frames.
- Recording still uses `ffmpeg`.
- ALSA microphone mute/status currently uses `arecord`/`amixer`.
- Vendor HID smart controls are written directly to `/dev/hidrawN`.
- Vendor HID tracking/target-tracking/audio/gesture state can be queried through `GET /api/pixy-hid/state`; unknown response values are left as `null` rather than guessed.
- UVC extension selectors are documented as raw investigation data only and are not exposed as normal controls.

Validated MJPG preview formats:

| Format | Result |
| --- | --- |
| `3840x2160@30` | native preview OK |
| `2560x1440@30` | native preview OK |
| `1920x1080@60` | native preview OK |
| `1920x1080@30` | native preview OK |
| `1280x960@30` | native preview OK |
| `1280x720@60` | native preview OK |
| `1280x720@30` | native preview OK |
| `1024x576@60` | native preview OK |
| `1024x576@30` | native preview OK |
| `960x720@30` | native preview OK |
| `800x600@30` | native preview OK |
| `640x480@30` | native preview OK |
| `640x360@60` | native preview OK |
| `640x360@30` | native preview OK |

The YUYV formats `640x480@30` and `640x360@30` were validated through the current ffmpeg fallback preview path.

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

Capture `pcaps/16.pcapng` confirmed EMEET Studio's Anti Flicker UI maps directly to `power_line_frequency`:

| EMEET Studio label | UVC selector | Value |
| --- | --- | ---: |
| Anti Flicker 50Hz | Processing Unit selector `0x05` | `1` |
| Anti Flicker 60Hz | Processing Unit selector `0x05` | `2` |

### Effects

Capture `pcaps/15.pcapng` showed that EMEET Studio effects are standard UVC Processing Unit writes, not HID commands.

| Effect | Brightness | Contrast | Sharpness | Saturation | Hue | WB auto | WB temperature |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bright | `180` | `150` | `128` | `128` | `128` | unchanged | unchanged |
| Nostalgia | `128` | `128` | `80` | `100` | `128` | `0` | `7500` |
| Blue | `128` | `128` | `128` | `128` | `128` | already manual in capture | `4250` |
| Cold | `128` | `70` | `255` | `170` | `128` | `1` | unchanged |
| Vivid | `170` | `140` | `128` | `140` | `128` | unchanged | unchanged |
| Default | `128` | `128` | `128` | `128` | `128` | already auto in capture | unchanged |

### Custom Image Controls

Capture `pcaps/27.pcapng` showed that EMEET Studio's Custom image panel is also standard UVC, not HID and not the vendor extension unit.

| EMEET Studio label | UVC entity/selector | Linux V4L2 control | Observed range/value |
| --- | --- | --- | --- |
| Brightness | Processing Unit `0x03`, selector `0x02` | `brightness` | `0..255` |
| Contrast | Processing Unit `0x03`, selector `0x03` | `contrast` | `0..255` |
| EV | Camera Terminal `0x01`, selectors `0x02` and `0x04` | `auto_exposure`, `exposure_time_absolute` | Studio moved exposure between `5000` and `1` after switching manual exposure on |
| ISO | Processing Unit `0x03`, selector `0x04` | `gain` | `0..100` |
| Sharpness | Processing Unit `0x03`, selector `0x08` | `sharpness` | `0..255` |
| Saturation | Processing Unit `0x03`, selector `0x07` | `saturation` | `0..255` |
| Tone | Processing Unit `0x03`, selector `0x06` | `hue` | `0..255` |
| AWB lock | Processing Unit `0x03`, selector `0x0b` | `white_balance_automatic` | `0` for locked/manual, `1` for auto |
| WB | Processing Unit `0x03`, selector `0x0a` | `white_balance_temperature` | `2300..7500` |

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

Capture `pcaps/23.pcapng` confirmed EMEET Studio's far/near zoom slider uses the standard UVC Camera Terminal `Zoom (Absolute)` control, not HID and not a vendor UVC extension selector.

| EMEET Studio action | UVC selector | Payload | Value |
| --- | --- | --- | ---: |
| Zoom near | Camera Terminal selector `0x0b` | `96 00` | `150` |
| Zoom far | Camera Terminal selector `0x0b` | `64 00` | `100` |

The Linux `zoom_absolute` V4L2 control is therefore the correct implementation path for zoom. `zoom_continuous` remains hidden because Linux exposes it as a zero-width range on this camera.

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

EMEET Studio uses normal UVC Probe/Commit negotiation for its format picker. Capture `pcaps/13 video res.pcapng` mapped these Studio labels:

| EMEET Studio label | UVC format index | UVC frame index | Frame interval | Linux format |
| --- | ---: | ---: | ---: | --- |
| 2K | `1` | `2` | `333333` | `MJPG 2560x1440@30` |
| 4K | `1` | `1` | `333333` | `MJPG 3840x2160@30` |
| 1080P 60FPS | `1` | `3` | `166666` | `MJPG 1920x1080@60` |
| 1080P 30FPS | `1` | `3` | `333333` | `MJPG 1920x1080@30` |
| 720P 30FPS | `1` | `5` | `333333` | `MJPG 1280x720@30` |

No vendor HID or UVC Extension Unit command was observed for these format changes.

PixyPilot applies these format changes with native `VIDIOC_S_FMT` and `VIDIOC_S_PARM` calls. Active preview streams are stopped before changing format to avoid `EBUSY` from the V4L2 device.

## Confirmed Audio Controls

The PIXY microphone can be controlled through standard ALSA.

- `Mic Capture Switch`: read/write boolean, used for mute.
- `Mic Capture Volume`: read/write integer `0..10`.

PixyPilot mutes the microphone when entering camera privacy mode. It does not automatically unmute when privacy mode is turned off, because that should remain an explicit user choice.

### Monitor / Listen

Capture `pcaps/18.pcapng` showed EMEET Studio's monitor/listen action using normal USB Audio streaming setup:

- The host selected audio interface `3`, alternate setting `1`.
- The host sent a USB Audio endpoint `SET_CUR` to endpoint `0x83`.
- Payload `80 bb 00` is little-endian `48000`, setting the endpoint sample frequency to 48 kHz.
- The host later selected audio interface `3`, alternate setting `0`.

No HID command or UVC control write was observed for the 100 -> 0 -> 100 monitor slider in that capture. Current interpretation: monitor/listen is a local application playback feature, and the slider is likely local monitor playback volume rather than camera-side mic gain.

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

- `00`: Standard Mode / idle
- `01`: Tracking Mode / Auto Follow
- `02`: Privacy Mode

Follow-up/query-like command:

```text
09 01 01 01
```

Vendor-facing EMEET material describes Privacy Mode as reachable three ways:

- Physical tilt: manually rotate the camera downward.
- App command: EMEET Studio can command Privacy Mode directly.
- Timer: product listings describe timer-based privacy, but local tests could not make it trigger in EMEET Studio.

PixyPilot has confirmed the app-command path through group `01` value `02`. Physical tilt is documented by EMEET, but it is not a host command. Timer-based privacy remains unconfirmed as working behavior. Privacy mode has been observed to darken the camera image. It appears to be an explicit camera state, not just a delayed timer. The auto-privacy delay is separate.

### Target Tracking

`RoseWaveStudio/PixyBar` identifies a separate target-tracking command family:

```text
09 04 01 00 00 0d 00 0d MM XX XX XX XX YY YY YY YY SS SS SS SS
09 04 01 01
```

Current mapping from that project, now exposed by PixyPilot:

| Mode byte | Meaning |
| --- | --- |
| `00` | Off |
| `01` | Face |
| `02` | Half-body |
| `03` | Full-body |

The three trailing values are little-endian float32 fields. PixyBar uses `0.5`, `0.5`, and `1.0` when enabling tracking. PixyPilot uses the same defaults and queries the readback through HID diagnostics.

### Auto Privacy Delay

Set command:

```text
09 02 01 00 00 04 00 04 XX XX XX XX
```

Current interpretation:

- `XX XX XX XX` is a 32-bit little-endian timeout in seconds.
- `00 00 00 00` disables the automatic transition.
- This configures a delay, but it does not itself immediately enter privacy mode.
- The delay write is confirmed from EMEET Studio captures, but the camera-side trigger condition has not been confirmed. As of June 10, 2026, PixyPilot should treat this as experimental.
- Capture `pcaps/28.pcapng` repeated a `10s` delay write, then showed no later explicit privacy command before the next delay write. That argues against a simple Windows-side 10-second timer in that capture, but does not prove the firmware trigger condition.
- Capture `pcaps/28.pcapng` also showed device-to-host responses shaped like `09 02 00 02 00 01 00 01 XX`: `XX=03` while privacy was active and `XX=00` after returning to tracking/off. This may be a related privacy/auto-privacy status field, but it is not decoded.
- Capture `pcaps/30.pcapng` isolated Standard Mode plus Assistance-tab Auto-Enter Privacy enabled with a 10-second delay. The only HID traffic was the group `02` delay write/readback; no automatic privacy transition occurred during the 42-second capture. PixyPilot should not present this as a working automatic privacy feature until the missing trigger condition is discovered.

Follow-up/query-like command:

```text
09 02 01 01
```

Known values captured from EMEET Studio:

| UI value | Seconds | Payload bytes |
| --- | ---: | --- |
| Never | `0` | `00 00 00 00` |
| 10 seconds | `10` | `0a 00 00 00` |
| 1 minute | `60` | `3c 00 00 00` |
| 15 minutes | `900` | `84 03 00 00` |

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

### Auto Rotate When Upside Down

Capture analyzed:

```text
pcaps/12-on off gesture and rotate.pcapng
```

Set command:

```text
09 04 00 08 00 02 00 02 04 XX
```

Known values for `XX`:

- `00`: off
- `01`: on

Status/query-like command:

```text
09 04 00 07 00 01 00 01 04
```

The device response mirrors the state:

```text
09 04 00 07 00 02 00 02 04 XX
```

An additional input report was observed after both on and off transitions:

```text
09 63 02 01 00 02 00 02 01 20
```

Current interpretation: auto-rotate is a group `0x04` feature with feature id `0x04`. The `09 63...` report is likely an async notification or acknowledgement, but its exact meaning is not decoded.

### Mirror / Flip

Capture analyzed:

```text
pcaps/17.pcapng
```

Set command:

```text
09 04 00 08 00 02 00 02 FF XX
```

Status/query-like command:

```text
09 04 00 07 00 01 00 01 FF
```

The device response mirrors the state:

```text
09 04 00 07 00 02 00 02 FF XX
```

Known feature ids for `FF`:

| Feature | Feature id | `XX` values |
| --- | ---: | --- |
| horizontal flip | `01` | `00` off, `01` on |
| vertical flip | `02` | `00` off, `01` on |

Current interpretation: these are independent HID toggles. PixyPilot exposes them as a four-state mirror control: Off, H, V, and HV.

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

Capture `pcaps/14 audio mode.pcapng` confirmed the official EMEET Studio UI labels:

| EMEET Studio label | Value |
| --- | --- |
| NC | `01` |
| Live | `02` |
| Original | `03` |

The status response mirrors the configured mode:

```text
09 05 00 04 00 01 00 01 XX
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

PixyPilot exposes a read-only probe for these selectors:

```text
GET /api/devices/{videoN}/uvc-extension/selectors
POST /api/devices/{videoN}/uvc-extension/capture?save=false
POST /api/devices/{videoN}/uvc-extension/capture?save=true
```

The web UI exposes the same flow in `Future Deck -> UVC Extension`. `Probe` reads unit `2`, selectors `1..10`, and displays `GET_LEN`, `GET_INFO`, `GET_CUR`, `GET_MIN`, `GET_MAX`, `GET_RES`, and `GET_DEF` results when the device returns them. `Save` writes timestamped JSON snapshots under `diagnostics/uvc/`.

Saved snapshots are compared with the latest prior saved snapshot for the same device. The UI and JSON mark `changed_selectors`, `changed_since_previous`, and `changed_fields`, which makes official-app packet captures easier to correlate with Linux-side state.

These probes do not issue `SET_CUR`. Unknown selector writes remain disabled until a selector has a safe, reversible meaning.

The repeatable workflow is documented in [UVC_EXTENSION_CORRELATION.md](UVC_EXTENSION_CORRELATION.md).

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

The baseline does not include official EMEET Studio user actions, so it does not reveal the meaning of presets or vendor image modes.

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
| `09 01 01 01` | values `03`, `02`, and `00` seen at different times | Tracking/privacy state query; value `02` maps to Privacy, while value `03` remains unknown/non-privacy |
| `09 03 01 16 ... 01/02/03` | 14-byte responses echoing sub-value | Unknown group 3 structured status/config |
| `09 03 01 14` | 13-byte zero payload | Unknown group 3 status |
| `09 41 00 04`, `09 61 00 04` | short two-byte values ending in `20` | Unknown capability or version queries |
| `09 01 00 03` | ASCII device/build identifier | Device/build information query |
| `09 03 01 17` | one-byte value `20` | Unknown group 3 status |

Current conclusion from launch-idle:

- EMEET Studio startup gives us useful status queries, but not user-action commands.
- No clear UVC Extension Unit selector writes were observed during idle startup.
- The next captures must isolate one user action at a time so these startup queries can be separated from real feature commands.

Follow-up live checks on 2026-06-10 showed `09 01 01 01` returning value `03` after both Standard and Tracking commands, while Privacy returned value `02`. PixyPilot now decodes only `02` as verified Privacy. Value `03` is treated as verified non-privacy with set bits `[0, 1]`, but it is not proven to distinguish Standard from Tracking. The UI therefore shows device readback separately from the last commanded Standard/Tracking mode.

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
- This is not a separate Smart Pixy tracking command. It maps to standard UVC autofocus.
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
| `00` | Standard Mode / idle |
| `01` | Tracking Mode / Auto Follow |
| `02` | Privacy Mode |

Capture `pcaps/29.pcapng` confirmed this mapping directly from the EMEET Studio Control tab dropdown by cycling Tracking Mode -> Privacy Mode -> Standard Mode.

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

Known-position selected-area capture:

```text
pcaps/10-focusareas.pcapng
```

The user clicked top-left, top-right, bottom-left, bottom-right, then center. The observed selected-area payload bytes after the mode value were:

| Click | Payload bytes |
| --- | --- |
| top-left | `00 00 7f 7f` |
| top-right | `7f 00 7f 7f` |
| bottom-left | `00 7f 7f 7f` |
| bottom-right | `7f 7f 7f 7f` |
| center | `38 38 7f 7f` |

Current interpretation of selected-area payload:

- The first two bytes after the mode value appear to be X/Y coordinates.
- The coordinate range appears to be `0x00..0x7f`, with origin at the top-left.
- The final two bytes were `7f 7f` for all known-position clicks and may represent region size, bounds, or sentinel values.
- The center click produced `38 38`, so preview scaling/margins still need validation before implementing arbitrary click-to-focus.
- The three named modes are safe to expose. Selected-area clicking should be treated as experimental until the preview-to-device coordinate transform is validated.
- The earlier mockup labels `AF Trigger` and `AF Lock` should not be treated as separate missing official-app commands unless EMEET Studio exposes literal actions with those names. The captured official behavior corresponding to "focus on person" and "focus on position" is this Focus/Metering HID mode family.

PixyPilot implements the three captured Focus/Metering modes as Focus target buttons in the Focus Control panel. The selected-area button currently uses the captured center-ish coordinate payload until a live preview click target is added.

## Directional PTZ HID Jog

Capture `pcaps/21.pcapng` tested the official app PTZ arrow pad. The user reported pressing left three times, right three times, up three times, then down three times. The capture contains 9 visible host jog reports rather than all 12 reported clicks, but the axis/sign mapping is clear.

Directional jogs use HID interrupt reports, not standard UVC/V4L2 absolute pan/tilt writes:

```text
09 63 01 19 00 05 00 05 AX DD DD DD DD ...
```

Where `AX` is the axis and `DD DD DD DD` is a little-endian float32 delta:

| Direction | Axis | Delta bytes | Float |
| --- | --- | --- | --- |
| left | `01` | `00 00 80 3f` | `+1.0` |
| right | `01` | `00 00 80 bf` | `-1.0` |
| up | `02` | `00 00 80 3f` | `+1.0` |
| down | `02` | `00 00 80 bf` | `-1.0` |

Observed device responses looked like status/ack packets:

```text
09 63 01 19 00 02 00 02 01 20 ...
09 63 01 19 00 02 00 02 02 20 ...
```

## Circular PTZ HID Vector

Capture `pcaps/22.pcapng` tested the official app's circular PTZ control by moving it clockwise several times. This is distinct from the arrow-pad jog command above.

Circular movement uses HID interrupt reports:

```text
09 63 01 20 00 0c 00 0c XX XX XX XX YY YY YY YY ZZ ZZ ZZ ZZ ...
```

The 12-byte payload after the prefix decodes as three little-endian float32 values:

| Field | Observed behavior |
| --- | --- |
| X | horizontal vector, roughly `-30.0..+30.0` |
| Y | vertical vector, roughly `-30.0..+30.0` |
| Z | stayed `0.0` in this capture |

Examples:

| Bytes | Decoded |
| --- | --- |
| `a3 8b ae c0 a3 8b 2e 40 00 00 00 00` | X `-5.455`, Y `+2.727`, Z `0.0` |
| `00 00 f0 41 00 00 f0 c1 00 00 00 00` | X `+30.0`, Y `-30.0`, Z `0.0` |
| `00 00 00 00 00 00 00 00 00 00 00 00` | neutral/stop |

Observed device responses looked like status/ack packets:

```text
09 63 01 20 00 01 00 01 20 ...
```

## Degree-Based PTZ Motor Commands

`RoseWaveStudio/PixyBar` identifies an additional, more deterministic PTZ path than the captured EMEET Studio vector controls.

Relative movement:

```text
09 03 01 19 00 05 00 05 AX DD DD DD DD
```

Absolute movement:

```text
09 03 01 18 00 05 00 05 AX DD DD DD DD
```

`AX` is `01` for pan and `02` for tilt. `DD DD DD DD` is a little-endian float32 degree value. Recenter/Home is implemented as absolute pan `0.0`, then absolute tilt `0.0`.

Important caveat: the absolute movement header `09 03 01 18` is shared with the EMEET Studio preset-load command, but the payload shape is different. Preset load uses a one-byte slot payload: `09 03 01 18 00 01 00 01 SS`. Absolute motor movement uses a five-byte payload: axis plus float32.

## PTZ Preset Save

Capture `pcaps/24.pcapng` tested saving PTZ presets to official app slots 1, 2, and 3. Preset save uses HID interrupt reports, not V4L2 and not the UVC extension unit.

Saving a slot uses this host report:

```text
09 03 01 15 00 02 00 02 SS 01 ...
```

Where `SS` is the 1-based slot number.

The official app then queries that slot:

```text
09 03 01 16 00 01 00 01 SS ...
```

Observed device acknowledgement for the save report:

```text
09 03 01 15 00 01 00 01 20 ...
```

Observed query responses:

| Slot | Response payload after prefix | Decoded state |
| ---: | --- | --- |
| 1 | `01 01 0c 0e 16 c2 7b e7 38 c2 00 00 00 00` | slot `1`, saved, X `-37.514`, Y `-46.226`, Z `0.0` |
| 2 | `02 01 7e 26 16 c2 1e cb 38 c2 00 00 00 00` | slot `2`, saved, X `-37.538`, Y `-46.198`, Z `0.0` |
| 3 | `03 01 8f 2f 16 c2 70 ae 38 c2 00 00 00 00` | slot `3`, saved, X `-37.546`, Y `-46.170`, Z `0.0` |

Current interpretation: the response body is `slot`, `saved/enabled`, then three little-endian float32 values. The first two floats appear to represent the stored PTZ position. The third float stayed `0.0` in this capture.

## PTZ Preset Load

Capture `pcaps/25.pcapng` tested loading presets. The user selected default first, then slots 1, 2, and 3. The capture only showed distinct camera-side preset-load commands for slots 1, 2, and 3.

Loading a slot uses this HID report:

```text
09 03 01 18 00 01 00 01 SS ...
```

Observed slot loads:

| Slot | Host report |
| ---: | --- |
| 1 | `09 03 01 18 00 01 00 01 01` |
| 2 | `09 03 01 18 00 01 00 01 02` |
| 3 | `09 03 01 18 00 01 00 01 03` |

Observed acknowledgement:

```text
09 03 01 18 00 01 00 01 20 ...
```

After each HID slot-load report, EMEET Studio also sent a standard UVC `Zoom Absolute` write with value `100`:

```text
64 00
```

Current interpretation: HID command `18` restores the native preset PTZ position, while zoom is restored separately through the standard UVC `zoom_absolute` control. In capture 25 all loaded slots used zoom value `100`, likely because that was the stored zoom value from the preceding save capture.

## 1x To 2x App Zoom

Capture `pcaps/26.pcapng` tested an unknown official-app control that moved from `1x` to `2x`, then back down.

Observed USB behavior:

- No HID interrupt reports were present.
- No PIXY UVC `SET_CUR` writes occurred after initial enumeration.
- No UVC Extension Unit writes were present.
- No USB Audio control changes were present.
- The only sustained PIXY traffic after startup was video streaming.

Current interpretation: this official-app `1x..2x` control is likely local preview/software scaling or crop in EMEET Studio, not a camera-side USB command. This is separate from the real camera zoom control captured in `pcaps/23.pcapng`, which uses standard UVC `Zoom Absolute` values `100..150`.

## Known Gaps

These features are not fully decoded yet:

- Recording-area follow toggle write, if it ever proves distinct from standard tracking
- Official-app preset delete/default behavior
- Native UVC relative zoom behavior, if the official app exposes a separate continuous zoom gesture
- Names and payloads for UVC extension selectors `1..10`
- Whether some smart features use HID, UVC extension selectors, or both

Capture `pcaps/19.pcapng` was re-captured after setting follow mode and then starting recording. It includes PIXY traffic and shows recording startup at MJPG 1280x720 30 fps plus one group `01` HID status packet with value `01`, meaning tracking/follow was active. It did not include a host-to-device follow SET command, so it currently confirms that recording-area follow uses the already-known tracking state unless a later isolated toggle capture proves otherwise.

Capture `pcaps/20.pcapng` tested manual 90-degree rotate-left, 90-degree rotate-right, then restore. The PIXY control endpoint appears only during initial enumeration, there is no HID endpoint traffic, and no UVC/UVC-extension control writes occur after enumeration. The only sustained PIXY traffic is video streaming. Current conclusion: manual rotation in EMEET Studio is likely an application-side preview/output transform, not a camera-side USB command. This is separate from the decoded Auto Rotate when upside down HID toggle.

Capture `pcaps/23.pcapng` tested zoom far to near and back to far. The only control writes after streaming began were standard UVC `SET_CUR` writes to Camera Terminal entity `0x01`, selector `0x0b` (`Zoom Absolute`): value `150` for near and value `100` for far. No HID reports were present.

Capture `pcaps/24.pcapng` tested saving official app PTZ presets to slots 1, 2, and 3. It confirmed HID group `03`, command `15` saves a 1-based slot and command `16` queries that slot's saved state. PixyPilot implements native preset save from this capture.

Capture `pcaps/25.pcapng` tested loading presets. Slots 1, 2, and 3 used HID group `03`, command `18` with the 1-based slot number. EMEET Studio then wrote standard UVC Zoom Absolute value `100` after each load. PixyPilot implements native HID preset load and restores zoom from the local app preset when available.

Capture `pcaps/26.pcapng` tested an official-app `1x` to `2x` control. No HID reports, UVC writes, UVC extension writes, or audio controls occurred after enumeration. Current conclusion: that control is app-local preview/software scaling, not a camera-side command.

## Capture Plan

To decode missing behavior, capture one official-app action at a time. Start USBPcap/Wireshark, perform exactly one change, wait a few seconds, stop the capture, and save a clearly named file.

Recommended sequence:

1. Launch EMEET Studio and make no setting changes.
2. Toggle Auto Follow off/on.
3. Toggle Privacy off/on.
4. Toggle Gesture Control off/on.
5. Change each audio DSP mode once.
6. Capture any literal AF trigger or focus-lock action only if the official app exposes one separately from Focus/Metering.
7. Change one image-control preset or value at a time.
8. Change one video format, resolution, or FPS option at a time.

Local packet captures are intentionally ignored by git. Record findings in markdown, but keep raw captures private unless there is a clear reason to publish them.
