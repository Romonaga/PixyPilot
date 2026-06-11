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

## Future Architecture

These are valid scalability improvements, but they should wait until the PIXY control surface and reverse-engineering workflow are more stable.

- Application service container:
  - Replace scattered `get_xxx_service()` route factories with a central application container or service registry.
  - Keep FastAPI dependencies thin and have them resolve services from the registry.
  - Use the container to manage shared config, singleton service lifecycle, hotplug/video services, and test overrides.
  - Suggested timing: before Home Assistant, multi-camera support, or long-lived background workflows.
- Capability discovery:
  - Replace static `KNOWN_CONTROLS` with runtime capability discovery.
  - Add a camera capability model that can report availability, source, and confidence.
  - Example shape:

    ```json
    {
      "tracking": { "available": true, "source": "hid", "confirmed": true },
      "ptz_vector": { "available": true, "source": "hid", "confirmed": true },
      "zoom_absolute": { "available": true, "source": "v4l2", "confirmed": true },
      "uvc_extension": { "available": true, "source": "uvc_xu", "confirmed": false }
    }
    ```

  - Use discovered capabilities to drive UI visibility instead of hard-coded known control lists.
  - Suggested timing: before provider abstraction, because providers should expose the same capability contract.
- Camera provider abstraction:
  - Keep PixyPilot PIXY-first while behavior is still being decoded.
  - Later introduce a provider boundary:

    ```text
    CameraProvider
      GenericUvcProvider
      EmeetPixyProvider
    ```

  - Move generic V4L2/UVC streaming, controls, formats, preview, and recording into a generic provider path.
  - Keep EMEET PIXY HID, decoded smart controls, UVC extension diagnostics, and packet-capture correlation in the PIXY provider.
  - Suggested timing: after capability discovery and after the confirmed PIXY behavior is stable.

## Packaging And Distribution

- Add systemd user service examples for the backend.
- Add `.desktop` launcher for the web UI.
- Package the tray app for common Linux desktops.
- Prepare Home Assistant HACS installation docs.
- Add a small public demo GIF or short video in the README.
