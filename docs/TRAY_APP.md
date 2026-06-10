# Linux Tray App

PixyPilot includes an optional tiny tray controller at `tools/pixypilot-tray.py`.

The tray app is intentionally separate from the FastAPI backend so desktop GUI dependencies do not become required for headless/server installs.

## Install

```bash
python3 -m pip install pystray pillow
```

Linux tray support may also require the desktop environment's AppIndicator/GTK tray packages.

## Run

Start the PixyPilot backend first, then run:

```bash
tools/pixypilot-tray.py
```

The tray helper reads the backend host and port from `config/pixypilot.yaml`.

## Current Tray Actions

- Privacy on + mic mute
- Privacy off
- Auto Follow on
- Auto Follow off
- Mic mute
- Mic live
- Load PTZ preset slots 1, 2, and 3

## Next Tray Work

- Package as a `.desktop` autostart entry.
- Show current privacy/mic/tracking state in the menu.
- Add named scene support once PixyPilot has backend scene apply endpoints.
- Add notifications for camera privacy transitions.
