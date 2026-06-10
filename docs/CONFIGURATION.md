# PixyPilot Configuration

PixyPilot uses `config/pixypilot.yaml` for normal user configuration.

## Default Config

```yaml
safety:
  start_in_privacy: true

server:
  host: 127.0.0.1
  port: 8000
  reload: false

frontend:
  dist: frontend/dist
  dev_server:
    host: 127.0.0.1
    port: 5173

cors:
  origins: []

storage:
  presets: config/presets.yaml
  recordings: recordings

hid:
  path:
  report_gap_ms: 25
```

## Normal Mode

Run:

```bash
./tools/run-pixypilot.sh
```

Open the address configured under `server.host` and `server.port`. The default is:

```text
http://127.0.0.1:8000
```

In normal mode, this one address serves both the API and the React UI.

## Common Changes

Expose PixyPilot on the local network:

```yaml
server:
  host: 0.0.0.0
  port: 8000
```

Store recordings somewhere else:

```yaml
storage:
  recordings: /home/YOUR_USER/Videos/PixyPilot
```

Use a fixed HID path for diagnostics:

```yaml
hid:
  path: /dev/hidraw14
```

Host, port, storage, and HID timing changes require restarting PixyPilot.

## Developer Mode

Developer mode is only for editing PixyPilot itself. It runs FastAPI on `127.0.0.1:8000` and Vite on `127.0.0.1:5173` for hot reload. Normal users should use `./tools/run-pixypilot.sh` instead.
