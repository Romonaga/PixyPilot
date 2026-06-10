import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchVideoRecordingStatus,
  startVideoRecording,
  stopVideoRecording
} from "../lib/apiClient";
import type { VideoFormatOption } from "../types/api";
import { useVideoCapture } from "./useVideoCapture";

vi.mock("../lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("../lib/apiClient")>("../lib/apiClient");
  return {
    ...actual,
    fetchVideoRecordingStatus: vi.fn(),
    startVideoRecording: vi.fn(),
    stopVideoRecording: vi.fn()
  };
});

const mockedFetchVideoRecordingStatus = vi.mocked(fetchVideoRecordingStatus);
const mockedStartVideoRecording = vi.mocked(startVideoRecording);
const mockedStopVideoRecording = vi.mocked(stopVideoRecording);

const format: VideoFormatOption = {
  pixel_format: "MJPG",
  description: "Motion-JPEG",
  width: 1280,
  height: 720,
  fps: 30,
  label: "MJPG 1280x720 30fps"
};

describe("useVideoCapture", () => {
  beforeEach(() => {
    mockedFetchVideoRecordingStatus.mockReset();
    mockedStartVideoRecording.mockReset();
    mockedStopVideoRecording.mockReset();
    mockedFetchVideoRecordingStatus.mockResolvedValue({
      recording: false,
      device_name: null,
      path: null,
      started_at: null,
      reason: null
    });
  });

  it("builds a stream URL only when preview is enabled", async () => {
    const { result } = renderHook(() => useVideoCapture("video0", format));

    await waitFor(() => expect(result.current.status?.recording).toBe(false));

    expect(result.current.streamUrl).toBeNull();

    act(() => {
      result.current.togglePreview();
    });

    expect(result.current.streamUrl).toContain("/api/devices/video0/stream?");
    expect(result.current.streamUrl).toContain("pixel_format=MJPG");
    expect(result.current.streamUrl).toContain("width=1280");
  });

  it("starts and stops backend recording for the selected device and format", async () => {
    mockedStartVideoRecording.mockResolvedValue({
      recording: true,
      device_name: "video0",
      path: "/FastDrive/EmmetPixy/recordings/test.mkv",
      started_at: "2026-06-09T23:30:00Z",
      reason: null
    });
    mockedStopVideoRecording.mockResolvedValue({
      recording: false,
      device_name: "video0",
      path: "/FastDrive/EmmetPixy/recordings/test.mkv",
      started_at: "2026-06-09T23:30:00Z",
      reason: null
    });

    const { result } = renderHook(() => useVideoCapture("video0", format));

    await waitFor(() => expect(result.current.status?.recording).toBe(false));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockedStartVideoRecording).toHaveBeenCalledWith("video0", format);
    expect(result.current.status?.recording).toBe(true);

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(mockedStopVideoRecording).toHaveBeenCalled();
    expect(result.current.status?.recording).toBe(false);
  });
});
