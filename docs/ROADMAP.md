# PixyPilot Roadmap

This file tracks useful product ideas that are not required for the core camera control path.

## In Progress / First Batch

- Privacy-first startup:
  - Start in camera privacy mode when safety settings allow it.
  - Mute the microphone when entering privacy.
  - Show visible startup privacy state in the UI.
- Click-to-focus:
  - Click the live preview to send the decoded selected-area focus metering command.
  - Use the captured `0..127` coordinate range.
- Command log:
  - Show HID, V4L2, stream, focus, audio, recording, and safety status in a compact UI panel.
- Linux tray app:
  - Optional tray script for privacy, mute, Auto Follow, and PTZ preset load.

## Next High-Value Features

- Home Assistant integration:
  - Start with services: `pixypilot.preset`, `pixypilot.privacy`, `pixypilot.ptz_preset`, `pixypilot.auto_follow`, and `pixypilot.set_audio_mode`.
  - Add camera stream and switch/select entities after services are stable.
- Scenes:
  - Combine image preset, focus mode, PTZ slot, audio mode, privacy state, and video format.
  - Example scenes: Desk, Meeting, Whiteboard, Privacy, Low Light, Streaming.
- Backend preset apply endpoint:
  - Apply presets by name or ID from automations, Home Assistant, tray app, and scripts.
- Preset import/export:
  - YAML/JSON export for sharing known-good camera setups.
- OBS / streaming profile:
  - One-click 1080p60, Auto Follow, audio DSP mode, image preset, and recording/preview setup.

## Reverse-Engineering Work

- Decode UVC Extension Unit selectors `1..10`.
- Determine whether any smart feature uses both HID and UVC Extension Unit state.
- Confirm or rule out a distinct speaker-tracking command.
- Decode official-app preset delete/default behavior.
- Revisit UVC relative zoom if Linux exposes a useful path beyond the current no-op `zoom_continuous`.

## Packaging And Distribution

- Add systemd user service examples for the backend.
- Add `.desktop` launcher for the web UI.
- Package the tray app for common Linux desktops.
- Prepare Home Assistant HACS installation docs.
- Add a small public demo GIF or short video in the README.
