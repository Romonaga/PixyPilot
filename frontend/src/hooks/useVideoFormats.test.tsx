import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchVideoFormats, setVideoFormat } from "../lib/apiClient";
import { formatKey, useVideoFormats } from "./useVideoFormats";

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
    label: "MJPG 3840x2160 30fps"
  },
  {
    pixel_format: "MJPG",
    description: "Motion-JPEG, compressed",
    width: 1920,
    height: 1080,
    fps: 60,
    label: "MJPG 1920x1080 60fps"
  }
];

describe("useVideoFormats", () => {
  beforeEach(() => {
    mockedFetchVideoFormats.mockReset();
    mockedSetVideoFormat.mockReset();
  });

  it("loads formats and sets a selected format tuple", async () => {
    mockedFetchVideoFormats.mockResolvedValue(formats);
    mockedSetVideoFormat.mockResolvedValue(formats[1]);

    const { result } = renderHook(() => useVideoFormats("video0"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.selectedKey).toBe(formatKey(formats[0]));

    await act(async () => {
      await result.current.setSelectedKey(formatKey(formats[1]));
    });

    expect(mockedSetVideoFormat).toHaveBeenCalledWith("video0", formats[1]);
    expect(result.current.selectedKey).toBe(formatKey(formats[1]));
  });
});
