# Home Assistant Integration Plan

PixyPilot is a strong fit for Home Assistant because it turns the EMEET PIXY into a locally controlled PTZ camera device that can participate in automations, scenes, dashboards, and privacy routines.

The target user experience should be simple:

```yaml
service: pixypilot.preset
data:
  preset: desk
```

## Why This Matters

The Home Assistant audience is much larger than the EMEET PIXY audience. A custom integration gives PixyPilot another discovery path for searches like:

- Home Assistant EMEET PIXY
- Home Assistant PTZ camera control
- Linux PTZ camera automation
- EMEET Studio alternative
- local webcam privacy automation

## Proposed Integration Shape

Start as a Home Assistant custom integration named `pixypilot`.

Initial configuration:

```yaml
pixypilot:
  host: 127.0.0.1
  port: 8000
```

Later, this can become a config-flow integration discovered through the Home Assistant UI.

## Entities

Recommended first entities:

| Entity | Home Assistant platform | PixyPilot source |
| --- | --- | --- |
| `camera.pixypilot` | `camera` | MJPEG stream endpoint |
| `switch.pixypilot_privacy` | `switch` | HID tracking/privacy command |
| `switch.pixypilot_auto_follow` | `switch` | HID tracking command |
| `switch.pixypilot_gesture_control` | `switch` | HID gesture command |
| `switch.pixypilot_auto_rotate` | `switch` | HID auto-rotate command |
| `switch.pixypilot_mic_mute` | `switch` | ALSA mic mute endpoint |
| `select.pixypilot_audio_mode` | `select` | HID audio DSP mode |
| `select.pixypilot_video_format` | `select` | V4L2 format list and format setter |

PTZ absolute controls can be exposed as numbers later, but the first Home Assistant value is likely services, not sliders.

## Services

### `pixypilot.preset`

Apply a named PixyPilot preset.

```yaml
service: pixypilot.preset
data:
  preset: desk
```

Optional scope:

```yaml
service: pixypilot.preset
data:
  preset: desk
  scope: image
```

Recommended behavior:

- If `scope` is omitted, find the preset by name across image, focus, exposure, and PTZ presets.
- If multiple presets share the same name, require `scope`.
- Apply all controls in the preset using PixyPilot's API.
- Return a clear error if the preset is unknown.

Backend gap to close: PixyPilot currently stores image/focus/exposure presets and the frontend applies them client-side by writing individual V4L2 controls. For Home Assistant, add a backend endpoint such as:

```http
POST /api/control-presets/apply
Content-Type: application/json

{
  "name": "desk",
  "scope": "image"
}
```

### `pixypilot.ptz_home`

Return the camera to the default PTZ view.

```yaml
service: pixypilot.ptz_home
```

Recommended backend behavior:

- Set `pan_absolute` to `0`.
- Set `tilt_absolute` to `0`.
- Set `zoom_absolute` to default or `100`.

### `pixypilot.ptz_preset`

Load a native PIXY PTZ preset slot.

```yaml
service: pixypilot.ptz_preset
data:
  slot: 1
```

Supported slots are currently `1`, `2`, and `3`, matching EMEET Studio captures.

### `pixypilot.privacy`

Enable or disable privacy mode.

```yaml
service: pixypilot.privacy
data:
  enabled: true
```

Recommended behavior:

- `enabled: true` sends HID privacy mode.
- `enabled: false` sends HID tracking/off state.
- When privacy is enabled, PixyPilot should also mute the microphone.
- Disabling privacy should not automatically unmute the microphone unless the user explicitly asks for that behavior.

### `pixypilot.auto_follow`

Enable or disable Auto Follow / standard tracking.

```yaml
service: pixypilot.auto_follow
data:
  enabled: true
```

### `pixypilot.set_audio_mode`

Set the PIXY audio DSP mode.

```yaml
service: pixypilot.set_audio_mode
data:
  mode: live
```

Valid modes:

- `noise_cancel`
- `live`
- `original`

## Automation Examples

Desk scene:

```yaml
alias: Desk camera setup
sequence:
  - service: pixypilot.privacy
    data:
      enabled: false
  - service: pixypilot.preset
    data:
      preset: desk
      scope: image
  - service: pixypilot.ptz_preset
    data:
      slot: 1
```

Privacy when leaving home:

```yaml
alias: Camera privacy when away
trigger:
  - platform: state
    entity_id: person.me
    to: not_home
action:
  - service: pixypilot.privacy
    data:
      enabled: true
```

Morning meeting setup:

```yaml
alias: Morning meeting camera
trigger:
  - platform: calendar
    event: start
    entity_id: calendar.work
action:
  - service: pixypilot.privacy
    data:
      enabled: false
  - service: pixypilot.auto_follow
    data:
      enabled: true
  - service: pixypilot.set_audio_mode
    data:
      mode: noise_cancel
```

## Minimum Backend API Needed

Already available:

- `GET /api/devices`
- `GET /api/devices/{device_name}/controls`
- `PATCH /api/devices/{device_name}/controls/{control_name}`
- `GET /api/devices/{device_name}/formats`
- `PATCH /api/devices/{device_name}/format`
- `GET /api/devices/{device_name}/stream`
- `GET /api/control-presets`
- `PATCH /api/audio/mute`
- `PATCH /api/pixy-hid/tracking`
- `PATCH /api/pixy-hid/gesture`
- `PATCH /api/pixy-hid/auto-rotate`
- `PATCH /api/pixy-hid/audio`
- `PATCH /api/pixy-hid/ptz-preset/load`

Recommended additions:

- Apply a control preset by name or ID from the backend.
- Expose local PTZ preset names if we want `preset: desk` to include PTZ slot restore.
- Add a compact health/status endpoint for Home Assistant polling.
- Add optional token authentication before advertising LAN use.

## Implementation Phases

1. Add backend preset-apply endpoint.
2. Create `custom_components/pixypilot` with services only.
3. Add camera stream entity.
4. Add switch/select entities.
5. Add config flow and diagnostics.
6. Publish installation instructions for HACS.

The first useful release can be services-only. Home Assistant users can still call services from automations, scripts, dashboards, and scenes.
