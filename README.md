# PixyPilot

PixyPilot is a local Linux control deck for the EMEET PIXY camera.

The first implementation focuses on the confirmed V4L2/UVC control path:

- enumerate camera devices
- enumerate V4L2 controls
- expose controls as JSON
- validate and set values
- render a cockpit-style React UI for PTZ, image, focus, and exposure controls

The vendor-specific Pixy HID and raw UVC extension-unit capabilities are tracked in `PIXY_NOTES.md` and will be added as separate providers after local validation.

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

## Tests

```bash
cd backend
pytest

cd frontend
npm test
```
