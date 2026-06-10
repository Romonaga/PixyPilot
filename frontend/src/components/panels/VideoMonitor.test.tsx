import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UseVideoCaptureResult } from "../../hooks/useVideoCapture";
import type { UseVideoFormatsResult } from "../../hooks/useVideoFormats";
import { VideoMonitor } from "./VideoMonitor";

function videoFormats(): UseVideoFormatsResult {
  return {
    formats: [
      {
        pixel_format: "MJPG",
        description: "Motion-JPEG",
        width: 1280,
        height: 720,
        fps: 30,
        label: "MJPG 1280x720 30fps"
      }
    ],
    selectedKey: "MJPG:1280:720:30",
    selectedFormat: {
      pixel_format: "MJPG",
      description: "Motion-JPEG",
      width: 1280,
      height: 720,
      fps: 30,
      label: "MJPG 1280x720 30fps"
    },
    isLoading: false,
    pending: false,
    error: null,
    setSelectedKey: vi.fn(),
    refresh: vi.fn()
  };
}

function videoCapture(): UseVideoCaptureResult {
  return {
    previewEnabled: true,
    streamUrl: "/api/devices/video0/stream",
    status: {
      recording: false,
      device_name: null,
      path: null,
      started_at: null,
      reason: null
    },
    pending: false,
    error: null,
    refreshStatus: vi.fn(),
    togglePreview: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn()
  };
}

function pixyHid(setFocusMeteringMode = vi.fn().mockResolvedValue(undefined)): UsePixyHidResult {
  return {
    status: {
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["focus_metering"]
    },
    isLoading: false,
    pendingCommand: null,
    error: null,
    lastCommand: null,
    trackingMode: null,
    gestureEnabled: null,
    autoRotateEnabled: null,
    mirrorMode: null,
    focusMeteringMode: null,
    focusMeteringPoint: null,
    audioMode: null,
    autoPrivacySeconds: null,
    refresh: vi.fn(),
    setTrackingMode: vi.fn(),
    setGestureEnabled: vi.fn(),
    setAutoRotateEnabled: vi.fn(),
    setMirrorMode: vi.fn(),
    setFocusMeteringMode,
    setAudioMode: vi.fn(),
    setAutoPrivacySeconds: vi.fn(),
    sendPtzDirection: vi.fn(),
    sendPtzVector: vi.fn(),
    savePtzPreset: vi.fn(),
    loadPtzPreset: vi.fn()
  };
}

describe("VideoMonitor", () => {
  it("sends selected-area focus coordinates from a preview click", async () => {
    const setFocusMeteringMode = vi.fn().mockResolvedValue(undefined);
    render(
      <VideoMonitor
        deviceName="video0"
        videoFormats={videoFormats()}
        videoCapture={videoCapture()}
        pixyHid={pixyHid(setFocusMeteringMode)}
      />
    );
    const frame = screen.getByAltText("Live camera stream").parentElement!;
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 720,
      toJSON: () => ({})
    });

    fireEvent.pointerUp(frame, { clientX: 640, clientY: 360 });

    await waitFor(() =>
      expect(setFocusMeteringMode).toHaveBeenCalledWith("selected_area", { x: 64, y: 64 })
    );
    expect(frame.querySelector(".focus-target-reticle")).not.toBeNull();
  });
});
