import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchPixyHidStatus,
  setPixyAudio,
  setPixyAutoPrivacy,
  setPixyAutoRotate,
  setPixyGesture,
  setPixyMirror,
  sendPixyPtzDirection,
  setPixyTracking
} from "../lib/apiClient";
import { usePixyHid } from "./usePixyHid";

vi.mock("../lib/apiClient", () => ({
  fetchPixyHidStatus: vi.fn(),
  setPixyAudio: vi.fn(),
  setPixyAutoPrivacy: vi.fn(),
  setPixyAutoRotate: vi.fn(),
  setPixyGesture: vi.fn(),
  setPixyMirror: vi.fn(),
  sendPixyPtzDirection: vi.fn(),
  setPixyTracking: vi.fn()
}));

const mockedFetchPixyHidStatus = vi.mocked(fetchPixyHidStatus);
const mockedSetPixyAudio = vi.mocked(setPixyAudio);
const mockedSetPixyAutoPrivacy = vi.mocked(setPixyAutoPrivacy);
const mockedSetPixyAutoRotate = vi.mocked(setPixyAutoRotate);
const mockedSetPixyGesture = vi.mocked(setPixyGesture);
const mockedSetPixyMirror = vi.mocked(setPixyMirror);
const mockedSendPixyPtzDirection = vi.mocked(sendPixyPtzDirection);
const mockedSetPixyTracking = vi.mocked(setPixyTracking);

describe("usePixyHid", () => {
  beforeEach(() => {
    mockedFetchPixyHidStatus.mockReset();
    mockedSetPixyAudio.mockReset();
    mockedSetPixyAutoPrivacy.mockReset();
    mockedSetPixyAutoRotate.mockReset();
    mockedSetPixyGesture.mockReset();
    mockedSetPixyMirror.mockReset();
    mockedSendPixyPtzDirection.mockReset();
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

  it("sends auto rotate commands when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["auto_rotate"]
    });
    mockedSetPixyAutoRotate.mockResolvedValue({
      ok: true,
      command: "auto_rotate",
      value: true,
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setAutoRotateEnabled(true);
    });

    expect(mockedSetPixyAutoRotate).toHaveBeenCalledWith(true);
    expect(result.current.autoRotateEnabled).toBe(true);
  });

  it("sends mirror mode commands when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["mirror"]
    });
    mockedSetPixyMirror.mockResolvedValue({
      ok: true,
      command: "mirror",
      value: "hv",
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setMirrorMode("hv");
    });

    expect(mockedSetPixyMirror).toHaveBeenCalledWith("hv");
    expect(result.current.mirrorMode).toBe("hv");
  });

  it("sends captured HID PTZ direction commands when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["ptz_direction"]
    });
    mockedSendPixyPtzDirection.mockResolvedValue({
      ok: true,
      command: "ptz_direction",
      value: "left",
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendPtzDirection("left");
    });

    expect(mockedSendPixyPtzDirection).toHaveBeenCalledWith("left");
    expect(result.current.lastCommand).toBe("ptz:left");
  });
});
