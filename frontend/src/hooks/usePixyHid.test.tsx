import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchPixyHidStatus,
  fetchSettings,
  setPixyAudio,
  setPixyAutoPrivacy,
  setPixyGesture,
  setPixyTracking
} from "../lib/apiClient";
import { resetPixyHidStartupSafetyForTests, usePixyHid } from "./usePixyHid";

vi.mock("../lib/apiClient", () => ({
  fetchPixyHidStatus: vi.fn(),
  fetchSettings: vi.fn(),
  setPixyAudio: vi.fn(),
  setPixyAutoPrivacy: vi.fn(),
  setPixyGesture: vi.fn(),
  setPixyTracking: vi.fn()
}));

const mockedFetchPixyHidStatus = vi.mocked(fetchPixyHidStatus);
const mockedFetchSettings = vi.mocked(fetchSettings);
const mockedSetPixyAudio = vi.mocked(setPixyAudio);
const mockedSetPixyAutoPrivacy = vi.mocked(setPixyAutoPrivacy);
const mockedSetPixyGesture = vi.mocked(setPixyGesture);
const mockedSetPixyTracking = vi.mocked(setPixyTracking);

describe("usePixyHid", () => {
  beforeEach(() => {
    resetPixyHidStartupSafetyForTests();
    mockedFetchPixyHidStatus.mockReset();
    mockedFetchSettings.mockReset();
    mockedSetPixyAudio.mockReset();
    mockedSetPixyAutoPrivacy.mockReset();
    mockedSetPixyGesture.mockReset();
    mockedSetPixyTracking.mockReset();
  });

  it("sends privacy mode once on startup when HID is writable", async () => {
    mockedFetchSettings.mockResolvedValue({
      safety: {
        start_in_privacy: true
      }
    });
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

    await waitFor(() => expect(mockedSetPixyTracking).toHaveBeenCalledWith("privacy"));
    await waitFor(() => expect(result.current.trackingMode).toBe("privacy"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockedSetPixyTracking).toHaveBeenCalledTimes(1);
  });

  it("does not send startup privacy mode when HID is not writable", async () => {
    mockedFetchSettings.mockResolvedValue({
      safety: {
        start_in_privacy: true
      }
    });
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: false,
      reason: "HID device is present but not writable by this user",
      known_controls: ["tracking", "privacy"]
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedSetPixyTracking).not.toHaveBeenCalled();
  });

  it("does not send startup privacy mode when the safety setting is disabled", async () => {
    mockedFetchSettings.mockResolvedValue({
      safety: {
        start_in_privacy: false
      }
    });
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

    expect(mockedSetPixyTracking).not.toHaveBeenCalled();
  });
});
