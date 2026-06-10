#!/usr/bin/env python3
"""Small optional Linux tray controller for PixyPilot.

Install optional dependencies with:
  python3 -m pip install pystray pillow

Run with:
  PIXYPILOT_API=http://127.0.0.1:8000 tools/pixypilot-tray.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError as exc:
    raise SystemExit(
        "PixyPilot tray requires optional packages: python3 -m pip install pystray pillow"
    ) from exc


API_BASE = os.environ.get("PIXYPILOT_API", "http://127.0.0.1:8000").rstrip("/")


def request_json(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{API_BASE}{path}",
        data=data,
        method=method,
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            raw = response.read()
    except urllib.error.URLError as exc:
        print(f"PixyPilot tray request failed: {exc}", file=sys.stderr)
        return None
    return json.loads(raw.decode("utf-8")) if raw else None


def privacy_on() -> None:
    request_json("PATCH", "/api/pixy-hid/tracking", {"mode": "privacy"})
    request_json("PATCH", "/api/audio/mute", {"muted": True})


def privacy_off() -> None:
    request_json("PATCH", "/api/pixy-hid/tracking", {"mode": "off"})


def auto_follow_on() -> None:
    request_json("PATCH", "/api/pixy-hid/tracking", {"mode": "tracking"})


def auto_follow_off() -> None:
    request_json("PATCH", "/api/pixy-hid/tracking", {"mode": "off"})


def mic_mute(muted: bool) -> None:
    request_json("PATCH", "/api/audio/mute", {"muted": muted})


def load_ptz_preset(slot: int) -> None:
    request_json("PATCH", "/api/pixy-hid/ptz-preset/load", {"slot": slot})


def tray_icon() -> Image.Image:
    image = Image.new("RGBA", (64, 64), (4, 10, 14, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((6, 6, 58, 58), radius=14, fill=(13, 27, 32, 255), outline=(52, 230, 215, 255), width=3)
    draw.ellipse((21, 21, 43, 43), outline=(52, 230, 215, 255), width=4)
    draw.ellipse((29, 29, 35, 35), fill=(52, 230, 215, 255))
    return image


def main() -> None:
    icon = pystray.Icon(
        "PixyPilot",
        tray_icon(),
        "PixyPilot",
        pystray.Menu(
            pystray.MenuItem("Privacy on + mute", lambda _icon, _item: privacy_on()),
            pystray.MenuItem("Privacy off", lambda _icon, _item: privacy_off()),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Auto Follow on", lambda _icon, _item: auto_follow_on()),
            pystray.MenuItem("Auto Follow off", lambda _icon, _item: auto_follow_off()),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Mic mute", lambda _icon, _item: mic_mute(True)),
            pystray.MenuItem("Mic live", lambda _icon, _item: mic_mute(False)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("PTZ preset 1", lambda _icon, _item: load_ptz_preset(1)),
            pystray.MenuItem("PTZ preset 2", lambda _icon, _item: load_ptz_preset(2)),
            pystray.MenuItem("PTZ preset 3", lambda _icon, _item: load_ptz_preset(3)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", lambda icon, _item: icon.stop()),
        ),
    )
    icon.run()


if __name__ == "__main__":
    main()
