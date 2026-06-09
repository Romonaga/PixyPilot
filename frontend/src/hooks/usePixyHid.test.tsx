import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchPixyHidStatus,
  setPixyAudio,
  setPixyAutoPrivacy,
  setPixyGesture,
  setPixyTracking
} from "../lib/apiClient";
import { usePixyHid } from "./usePixyHid";

vi.mock("../lib/apiClient", () => ({
  fetchPixyHidStatus: vi.fn(),
  setPixyAudio: vi.fn(),
  setPixyAutoPrivacy: vi.fn(),
  setPixyGesture: vi.fn(),
  setPixyTracking: vi.fn()
}));

const mockedFetchPixyHidStatus = vi.mocked(fetchPixyHidStatus);
const mockedSetPixyAudio = vi.mocked(setPixyAudio);
const mockedSetPixyAutoPrivacy = vi.mocked(setPixyAutoPrivacy);
const mockedSetPixyGesture = vi.mocked(setPixyGesture);
const mockedSetPixyTracking = vi.mocked(setPixyTracking);

describe("usePixyHid", () => {
  beforeEach(() => {
    mockedFetchPixyHidStatus.mockReset();
    mockedSetPixyAudio.mockReset();
    mockedSetPixyAutoPrivacy.mockReset();
    mockedSetPixyGesture.mockReset();
    mockedSetPixyTracking.mockReset();
  });

  it("loads HID status without sending startup commands", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["tracking", "privacy"]
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status?.writable).toBe(true);
    expect(mockedSetPixyTracking).not.toHaveBeenCalled();
  });

  it("sends tracking commands when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["tracking", "privacy"]
    });
    mockedSetPixyTracking.mockResolvedValue({
      ok: true,
      command: "tracking",
      value: "privacy",
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setTrackingMode("privacy");
    });

    expect(mockedSetPixyTracking).toHaveBeenCalledWith("privacy");
    expect(result.current.trackingMode).toBe("privacy");
  });
});
