# UVC Extension Correlation Guide

PixyPilot treats EMEET PIXY UVC Extension Unit controls as read-only until a selector has been correlated with official app behavior.

The PIXY is UVC-compliant as a webcam, but smart-camera behavior can still live behind vendor-specific UVC Extension Unit selectors. The known extension unit is:

```text
Unit ID: 2
GUID: 46394292-0cd0-4ae3-8783-3133f9eaaa3b
Selectors: 1..10
```

## What PixyPilot Probes

The UVC Extension panel runs read-only `UVCIOC_CTRL_QUERY` calls for each selector:

```text
GET_INFO
GET_LEN
GET_CUR
GET_MIN
GET_MAX
GET_RES
GET_DEF
```

It does not send `SET_CUR` for unknown selectors.

Saved snapshots go to:

```text
diagnostics/uvc/
```

When a previous saved snapshot exists for the same `/dev/videoN` device, PixyPilot marks:

```text
changed_selectors
changed_since_previous
changed_fields
```

This is the main Linux-side tool for correlating official app behavior.

## Linux Baseline

1. Plug in the PIXY.
2. Start PixyPilot.
3. Open `Future Deck -> UVC Extension`.
4. Click `Save`.
5. Keep the saved JSON path with your test notes.

Also capture the USB descriptors once per firmware version:

```bash
lsusb -d 328f:00c0 -v > diagnostics/uvc/lsusb-emeet-pixy.txt
```

The descriptor dump confirms the extension unit ID, GUID, control bitmap, and selector count.

## Windows Capture Loop

Use this loop for every unknown feature:

1. Start USBPcap/Wireshark on Windows.
2. Open EMEET Studio.
3. Change exactly one setting.
4. Stop capture.
5. Name the capture with the feature and direction, for example:

```text
pcaps/31_uvc_auto_privacy_10s_to_never.pcapng
pcaps/32_uvc_tracking_standard_to_tracking.pcapng
```

6. Move the camera back to Linux.
7. In PixyPilot, click `Save` in `Future Deck -> UVC Extension`.
8. Check `changed_selectors` in the UI and saved JSON.

If a selector changed on Linux and the Windows pcap contains a matching UVC `SET_CUR`, we have a candidate mapping.

## Getting Captures From Windows Into PixyPilot

PixyPilot includes a `Windows Capture Inbox` panel for `.pcap` and `.pcapng` files.

The normal local upload flow is:

1. Bind PixyPilot to the LAN address in `config/pixypilot.yaml`:

```yaml
server:
  host: 0.0.0.0
  port: 8000
```

2. Restart PixyPilot.
3. From Windows, open:

```text
http://<linux-machine-ip>:8000
```

4. Use `Windows Capture Inbox` to select the USBPcap file, add the exact action label, and upload it.

Uploaded captures are stored under:

```text
pcaps/imports/
```

Each uploaded capture also gets a sidecar `.json` file with filename, action, notes, size, SHA-256, upload time, and source. The `pcaps/` directory is gitignored because captures can include host and device metadata.

Do not expose this app outside your trusted LAN until authentication exists.

## Wireshark Fields To Check

For UVC extension-unit traffic, look for USB control transfers with:

```text
bRequest: SET_CUR or GET_CUR
wIndex: interface + entity/unit id
wValue: selector/control id
payload: value bytes
```

For PIXY's known extension unit, the entity/unit id should match unit `2`.

The selector is the high byte of `wValue` for UVC controls. The payload bytes should match or explain the Linux `GET_CUR` value.

## Mapping Rules

Promote a selector from unknown to named only when all are true:

- The Windows capture changes one setting at a time.
- The capture shows a UVC Extension Unit `SET_CUR` for unit `2`.
- The selector and payload repeat across at least two captures.
- PixyPilot's Linux `GET_CUR` snapshot changes consistently after the official app writes it.
- The behavior is reversible.

If a selector changes during several unrelated actions, keep it raw.

## Current Safety Rule

Read everything. Write only confirmed mappings.

Unknown UVC extension selectors stay read-only in PixyPilot until their value range and behavior are understood.
