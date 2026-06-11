import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchVideoFormats, setVideoFormat } from "../lib/apiClient";
import { defaultPreviewFormat, formatKey, useVideoFormats } from "./useVideoFormats";

vi.mock("../lib/apiClient", () => ({
  fetchVideoFormats: vi.fn(),
  setVideoFormat: vi.fn()
}));

const mockedFetchVideoFormats = vi.mocked(fetchVideoFormats);
const mockedSetVideoFormat = vi.mocked(setVideoFormat);

const formats = [
  {
    pixel_format: "MJPG",
    description: "Motion-JPEG, compressed",
    width: 3840,
    height: 2160,
    fps: 30,
    frame_interval_100ns: 333333,
    label: "MJPG 3840x2160 30fps"
  },
  {
    pixel_format: "MJPG",
    description: "Motion-JPEG, compressed",
    width: 1920,
    height: 1080,
    fps: 60.00024000096,
    frame_interval_100ns: 166666,
    label: "MJPG 1920x1080 60fps"
  },
  {
    pixel_format: "MJPG",
    description: "Motion-JPEG, compressed",
    width: 1280,
    height: 720,
    fps: 30,
    frame_interval_100ns: 333333,
    label: "MJPG 1280x720 30fps"
  }
];

describe("useVideoFormats", () => {
  beforeEach(() => {
    mockedFetchVideoFormats.mockReset();
    mockedSetVideoFormat.mockReset();
  });

  it("loads formats and sets a selected format tuple", async () => {
    mockedFetchVideoFormats.mockResolvedValue(formats);
    mockedSetVideoFormat.mockResolvedValue({ ...formats[1], fps: 60.00024000096, label: "MJPG 1920x1080 60fps" });

    const { result } = renderHook(() => useVideoFormats("video0"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.selectedKey).toBe(formatKey(formats[2]));

    await act(async () => {
      await result.current.setSelectedKey(formatKey(formats[1]));
    });

    expect(mockedSetVideoFormat).toHaveBeenCalledWith("video0", formats[1]);
    expect(result.current.selectedKey).toBe(formatKey(formats[1]));
  });

  it("reverts the selected format when the backend rejects the change", async () => {
    mockedFetchVideoFormats.mockResolvedValue(formats);
    mockedSetVideoFormat.mockRejectedValue(new Error("Unable to set V4L2 format"));

    const { result } = renderHook(() => useVideoFormats("video0"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const originalKey = result.current.selectedKey;

    await act(async () => {
      await result.current.setSelectedKey(formatKey(formats[1]));
    });

    expect(result.current.selectedKey).toBe(originalKey);
    expect(result.current.error).toBe("Unable to set V4L2 format");
  });

  it("prefers a stable desktop preview format over the highest resolution", () => {
    expect(defaultPreviewFormat(formats)).toBe(formats[2]);
  });
});
