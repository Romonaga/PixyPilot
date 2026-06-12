import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { groupControls } from "../../domains/controls/grouping";
import type { UseAudioResult } from "../../hooks/useAudio";
import type { UseControlPresetsResult } from "../../hooks/useControlPresets";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UseDevicesResult } from "../../hooks/useDevices";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { UseVideoCaptureResult } from "../../hooks/useVideoCapture";
import type { UseVideoFormatsResult } from "../../hooks/useVideoFormats";
import type { AppSettings, Device, V4L2Control, VideoFormatOption } from "../../types/api";
import { AppShell } from "./AppShell";

function control(overrides: Partial<V4L2Control>): V4L2Control {
  return {
    name: "pan_absolute",
    label: "Pan",
    control_id: "0x1",
    group: "Camera Controls",
    kind: "int",
    value: 0,
    default: 0,
    min: -170,
    max: 170,
    step: 1,
    value_label: null,
    flags: [],
    menu: [],
    ...overrides
  };
}

const controlsList = [
  control({ name: "pan_absolute", label: "Pan" }),
  control({ name: "tilt_absolute", label: "Tilt", min: -30, max: 90 }),
  control({ name: "zoom_absolute", label: "Zoom", min: 1, max: 10 })
];

function controls(): UseControlsResult {
  return {
    controls: controlsList,
    groups: groupControls(controlsList),
    isLoading: false,
    error: null,
    pendingControl: null,
    refresh: vi.fn(),
    setValue: vi.fn(),
    setValues: vi.fn()
  };
}

const device: Device = {
  path: "/dev/video0",
  name: "EMEET PIXY: EMEET PIXY",
  driver: "uvcvideo",
  bus_info: "usb",
  is_capture: true
};

function devices(): UseDevicesResult {
  return {
    devices: [device],
    selectedDeviceName: "video0",
    selectedDevice: device,
    isLoading: false,
    error: null,
    setSelectedDeviceName: vi.fn(),
    refresh: vi.fn()
  };
}

const format: VideoFormatOption = {
  pixel_format: "MJPG",
  description: "Motion-JPEG",
  width: 1280,
  height: 720,
  fps: 30,
  frame_interval_100ns: 333333,
  label: "MJPG 1280x720 30fps"
};

function videoFormats(): UseVideoFormatsResult {
  return {
    formats: [format],
    selectedFormat: format,
    selectedKey: "MJPG:1280:720:333333",
    isLoading: false,
    pending: false,
    error: null,
    refresh: vi.fn(),
    setSelectedKey: vi.fn()
  };
}

function videoCapture(): UseVideoCaptureResult {
  return {
    previewEnabled: false,
    streamUrl: null,
    status: { recording: false, device_name: null, path: null, started_at: null, reason: null },
    pending: false,
    error: null,
    togglePreview: vi.fn(),
    restartPreview: vi.fn(),
    refreshStatus: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn()
  };
}

function pixyHid(): UsePixyHidResult {
  return {
    status: {
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["tracking", "privacy", "ptz_relative"]
    },
    isLoading: false,
    pendingCommand: null,
    error: null,
    lastCommand: null,
    trackingMode: "off",
    deviceTrackingState: "standard",
    deviceTrackingRawValue: 0,
    deviceTrackingRawBits: [],
    targetTrackingMode: null,
    targetTrackingRawValue: null,
    gestureEnabled: null,
    autoRotateEnabled: null,
    mirrorMode: null,
    focusMeteringMode: null,
    focusMeteringPoint: null,
    audioMode: null,
    autoPrivacySeconds: 0,
    refresh: vi.fn(),
    refreshStatus: vi.fn(),
    setTrackingMode: vi.fn(),
    setTargetTrackingMode: vi.fn(),
    setGestureEnabled: vi.fn(),
    setAutoRotateEnabled: vi.fn(),
    setMirrorMode: vi.fn(),
    setFocusMeteringMode: vi.fn(),
    setAudioMode: vi.fn(),
    setAutoPrivacySeconds: vi.fn(),
    sendPtzDirection: vi.fn(),
    sendPtzRelative: vi.fn(),
    sendPtzAbsolute: vi.fn(),
    sendPtzVector: vi.fn(),
    recenterPtz: vi.fn(),
    savePtzPreset: vi.fn(),
    loadPtzPreset: vi.fn()
  };
}

function audio(): UseAudioResult {
  return {
    status: { available: true, card: 3, name: "EMEET PIXY", muted: false, volume: 10, reason: null },
    isLoading: false,
    pending: false,
    error: null,
    refresh: vi.fn(),
    setMuted: vi.fn()
  };
}

const settings: AppSettings = {
  safety: { start_in_privacy: true },
  server: { host: "127.0.0.1", port: 8000, reload: false, url: "http://127.0.0.1:8000" },
  frontend: { dist_path: "frontend/dist", dev_server_host: "127.0.0.1", dev_server_port: 5173, single_port: true },
  storage: { presets_path: "config/presets.yaml", recordings_dir: "recordings" },
  hid: { path: null, report_gap_ms: 25 },
  config: { path: "config/pixypilot.yaml" }
};

function privacySafety(): UsePrivacySafetyResult {
  return {
    settings,
    settingsLoaded: true,
    startupPrivacyEnabled: true,
    startupPrivacyState: "sent",
    settingsError: null,
    settingsPending: false,
    refreshSettings: vi.fn(),
    saveSettings: vi.fn(),
    enterPrivacy: vi.fn(),
    leavePrivacy: vi.fn()
  };
}

function controlPresets(): UseControlPresetsResult {
  return {
    presets: [],
    isLoading: false,
    error: null,
    pendingPresetId: null,
    refresh: vi.fn(),
    presetsForScope: vi.fn().mockReturnValue([]),
    savePreset: vi.fn(),
    deletePreset: vi.fn()
  };
}

describe("AppShell", () => {
  it("keeps diagnostics out of the default working view until requested", async () => {
    const user = userEvent.setup();

    render(
      <AppShell
        devices={devices()}
        controls={controls()}
        videoFormats={videoFormats()}
        videoCapture={videoCapture()}
        pixyHid={pixyHid()}
        audio={audio()}
        privacySafety={privacySafety()}
        controlPresets={controlPresets()}
      />
    );

    expect(screen.getByRole("heading", { name: "Live Monitor" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Smart Pixy" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "HID Diagnostics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Future Deck" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Windows Capture Inbox" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Runtime Config" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Diagnostics" }));

    expect(screen.getByRole("heading", { name: "HID Diagnostics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Future Deck" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Windows Capture Inbox" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Runtime Config" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Live Monitor" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Runtime Config" })).toBeInTheDocument();
    expect(screen.getAllByText("Single address").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "HID Diagnostics" })).not.toBeInTheDocument();
  });
});
