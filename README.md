# PixyPilot

PixyPilot is a local Linux control deck for the EMEET PIXY camera.

The first implementation focuses on the confirmed V4L2/UVC control path:

- enumerate camera devices
- enumerate V4L2 controls
- expose controls as JSON
- validate and set values
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
