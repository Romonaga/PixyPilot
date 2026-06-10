import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UseAudioResult } from "../../hooks/useAudio";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { UseVideoCaptureResult } from "../../hooks/useVideoCapture";
import type { UseVideoFormatsResult } from "../../hooks/useVideoFormats";
import { CommandLogPanel } from "./CommandLogPanel";

describe("CommandLogPanel", () => {
  it("summarizes the active camera command state", () => {
    render(
      <CommandLogPanel
        controls={controls()}
        videoFormats={videoFormats()}
        videoCapture={videoCapture()}
        pixyHid={pixyHid()}
        audio={audio()}
        privacySafety={privacySafety()}
      />
    );

    expect(screen.getByText("Command Log")).toBeInTheDocument();
    expect(screen.getByText("tracking:privacy")).toBeInTheDocument();
    expect(screen.getByText("writing brightness")).toBeInTheDocument();
    expect(screen.getByText("selected_area @ 64,32")).toBeInTheDocument();
    expect(screen.getByText("MJPG 1280x720 30fps")).toBeInTheDocument();
    expect(screen.getByText("recording")).toBeInTheDocument();
    expect(screen.getByText("mic muted")).toBeInTheDocument();
    expect(screen.getByText("startup privacy sent")).toBeInTheDocument();
  });
});

function controls(): UseControlsResult {
  return {
    controls: [],
    groups: [],
    isLoading: false,
    error: null,
    pendingControl: "brightness",
    refresh: vi.fn(),
    setValue: vi.fn(),
    setValues: vi.fn()
  };
}

function videoFormats(): UseVideoFormatsResult {
  return {
    formats: [],
    selectedFormat: {
      pixel_format: "MJPG",
      description: "Motion-JPEG",
      width: 1280,
      height: 720,
      fps: 30,
      label: "MJPG 1280x720 30fps"
    },
    selectedKey: "MJPG:1280:720:30",
    isLoading: false,
    pending: false,
    error: null,
    refresh: vi.fn(),
    setSelectedKey: vi.fn()
  };
}

function videoCapture(): UseVideoCaptureResult {
  return {
    previewEnabled: true,
    streamUrl: "/stream",
    status: {
      recording: true,
      device_name: "video0",
      path: "/tmp/test.mkv",
      started_at: "2026-06-10T10:00:00Z",
      reason: null
    },
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
      known_controls: ["tracking", "focus_metering"]
    },
    isLoading: false,
    pendingCommand: null,
    error: null,
    lastCommand: "tracking:privacy",
    trackingMode: "privacy",
    gestureEnabled: null,
    autoRotateEnabled: null,
    mirrorMode: null,
    focusMeteringMode: "selected_area",
    focusMeteringPoint: { x: 64, y: 32 },
    audioMode: null,
    autoPrivacySeconds: null,
    refresh: vi.fn(),
    setTrackingMode: vi.fn(),
    setGestureEnabled: vi.fn(),
    setAutoRotateEnabled: vi.fn(),
    setMirrorMode: vi.fn(),
    setFocusMeteringMode: vi.fn(),
    setAudioMode: vi.fn(),
    setAutoPrivacySeconds: vi.fn(),
    sendPtzDirection: vi.fn(),
    sendPtzVector: vi.fn(),
    savePtzPreset: vi.fn(),
    loadPtzPreset: vi.fn()
  };
}

function audio(): UseAudioResult {
  return {
    status: {
      available: true,
      card: 3,
      name: "EMEET PIXY",
      muted: true,
      volume: 10,
      reason: null
    },
    isLoading: false,
    pending: false,
    error: null,
    refresh: vi.fn(),
    setMuted: vi.fn()
  };
}

function privacySafety(): UsePrivacySafetyResult {
  return {
    startupPrivacyEnabled: true,
    startupPrivacyState: "sent",
    enterPrivacy: vi.fn(),
    leavePrivacy: vi.fn()
  };
}
