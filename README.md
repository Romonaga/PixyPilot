# PixyPilot

PixyPilot is a local Linux control deck for the EMEET PIXY camera.

The first implementation focuses on the confirmed V4L2/UVC control path:

- enumerate camera devices
- enumerate V4L2 controls
- expose controls as JSON
- validate controls and set values through native V4L2 ioctls
- preview the selected camera stream
- record the selected stream to local disk
- render a cockpit-style React UI for PTZ, image, focus, and exposure controls

The vendor-specific Pixy HID path is now isolated in its own experimental provider. Raw UVC extension-unit capabilities are tracked in `PIXY_NOTES.md` and remain read-only until their selectors are decoded safely.

Reverse-engineering findings for other Linux users are collected in [docs/EMEET_PIXY_REVERSE_ENGINEERING.md](docs/EMEET_PIXY_REVERSE_ENGINEERING.md).

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

Standard camera control writes use native Linux V4L2 ioctls. `v4l2-ctl` is still used for device/control/format enumeration and format switching while those paths remain discovery-heavy.

## Control Presets

Image, focus, and exposure panels can save named local presets. Presets are stored in `config/presets.yaml`, which is ignored by git because those values are user/workspace specific.

Override the preset file with:

```bash
export PIXYPILOT_PRESETS_PATH=/path/to/presets.yaml
```

## Video Preview And Recording

PixyPilot uses `ffmpeg` for V4L2 preview and recording. The live monitor streams MJPEG through the backend, and recordings are written under `recordings/` by default. That directory is ignored by git because camera recordings are large and private.

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
