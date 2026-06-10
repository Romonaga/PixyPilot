# PixyPilot

PixyPilot is a local Linux control deck for the EMEET PIXY camera.

The current implementation focuses on confirmed Linux control paths:

- enumerate camera devices
- enumerate V4L2 controls
- enumerate V4L2 video formats
- expose controls as JSON
- validate controls and set values through native V4L2 ioctls
- switch video formats through native V4L2 ioctls
- preview the selected camera stream
- record the selected stream to local disk
- render a cockpit-style React UI for PTZ, image, focus, and exposure controls

The vendor-specific Pixy HID path is isolated in its own provider and now covers the decoded smart controls, directional/vector PTZ movement, mirror/rotate, focus metering, and native PTZ preset save/load. Raw UVC extension-unit capabilities are tracked in `PIXY_NOTES.md` and remain read-only until their selectors are decoded safely.

Reverse-engineering findings for other Linux users are collected in [docs/EMEET_PIXY_REVERSE_ENGINEERING.md](docs/EMEET_PIXY_REVERSE_ENGINEERING.md).

## Attribution

PixyPilot builds on the public EMEET PIXY reverse-engineering work published by `rm1138`:

- https://gist.github.com/rm1138/ef132c3a39f3c1effabf6354e2eca965

That work was the only public Linux-focused EMEET PIXY control reference we found early in the project, and it helped identify the device's useful control paths and HID report shape. PixyPilot's current implementation also includes additional local testing, packet captures from EMEET Studio, native V4L2 ioctl work, and UI/application code developed in this repository.

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn pixypilot.main:app --reload --host 127.0.0.1 --port 8000
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://127.0.0.1:8000` during development.

Standard V4L2 device inspection, control enumeration, format enumeration, control writes, and format switching use native Linux V4L2 ioctls. MJPG live preview also uses native V4L2 mmap capture.

## Control Presets

Image, focus, and exposure panels can save named local presets. Presets are stored in `config/presets.yaml`, which is ignored by git because those values are user/workspace specific.

Override the preset file with:

```bash
export PIXYPILOT_PRESETS_PATH=/path/to/presets.yaml
```

## Video Preview And Recording

PixyPilot streams live monitor frames through the backend as MJPEG.

- MJPG preview uses native V4L2 mmap capture and does not shell out to `ffmpeg`.
- Non-MJPG preview, such as YUYV, still falls back to `ffmpeg` because those raw frames need JPEG encoding for the browser stream.
- Recording still uses `ffmpeg` and writes files under `recordings/` by default.

The `recordings/` directory is ignored by git because camera recordings are large and private.

Override the recording directory with:

```bash
export PIXYPILOT_RECORDINGS_DIR=/path/to/recordings
```

## HID Permissions

PixyPilot needs write access to the PIXY hidraw node before experimental smart controls can work. Install the included udev rule once:

```bash
sudo install -m 0644 deploy/udev/70-pixypilot-hid.rules /etc/udev/rules.d/70-pixypilot-hid.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=hidraw
```

If the current `/dev/hidrawN` node does not update immediately, unplug and reconnect the camera. A working node should look like `root plugdev` with `crw-rw----`, and `/api/pixy-hid/status` should report `readable: true` and `writable: true`.

## Tests

```bash
cd backend
source .venv/bin/activate
pytest

cd frontend
npm test
```
