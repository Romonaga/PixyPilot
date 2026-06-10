import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchPixyHidStatus,
  setPixyAudio,
  setPixyAutoPrivacy,
  setPixyAutoRotate,
  setPixyGesture,
  setPixyFocusMetering,
  setPixyMirror,
  loadPixyPtzPreset,
  savePixyPtzPreset,
  sendPixyPtzDirection,
  sendPixyPtzVector,
  setPixyTracking
} from "../lib/apiClient";
import { usePixyHid } from "./usePixyHid";

vi.mock("../lib/apiClient", () => ({
  fetchPixyHidStatus: vi.fn(),
  setPixyAudio: vi.fn(),
  setPixyAutoPrivacy: vi.fn(),
  setPixyAutoRotate: vi.fn(),
  setPixyGesture: vi.fn(),
  setPixyFocusMetering: vi.fn(),
  setPixyMirror: vi.fn(),
  loadPixyPtzPreset: vi.fn(),
  savePixyPtzPreset: vi.fn(),
  sendPixyPtzDirection: vi.fn(),
  sendPixyPtzVector: vi.fn(),
  setPixyTracking: vi.fn()
}));

const mockedFetchPixyHidStatus = vi.mocked(fetchPixyHidStatus);
const mockedSetPixyAudio = vi.mocked(setPixyAudio);
const mockedSetPixyAutoPrivacy = vi.mocked(setPixyAutoPrivacy);
const mockedSetPixyAutoRotate = vi.mocked(setPixyAutoRotate);
const mockedSetPixyGesture = vi.mocked(setPixyGesture);
const mockedSetPixyFocusMetering = vi.mocked(setPixyFocusMetering);
const mockedSetPixyMirror = vi.mocked(setPixyMirror);
const mockedLoadPixyPtzPreset = vi.mocked(loadPixyPtzPreset);
const mockedSavePixyPtzPreset = vi.mocked(savePixyPtzPreset);
const mockedSendPixyPtzDirection = vi.mocked(sendPixyPtzDirection);
const mockedSendPixyPtzVector = vi.mocked(sendPixyPtzVector);
const mockedSetPixyTracking = vi.mocked(setPixyTracking);

describe("usePixyHid", () => {
  beforeEach(() => {
    mockedFetchPixyHidStatus.mockReset();
    mockedSetPixyAudio.mockReset();
    mockedSetPixyAutoPrivacy.mockReset();
    mockedSetPixyAutoRotate.mockReset();
    mockedSetPixyGesture.mockReset();
    mockedSetPixyFocusMetering.mockReset();
    mockedSetPixyMirror.mockReset();
    mockedLoadPixyPtzPreset.mockReset();
    mockedSavePixyPtzPreset.mockReset();
    mockedSendPixyPtzDirection.mockReset();
    mockedSendPixyPtzVector.mockReset();
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

  it("sends captured focus metering commands when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["focus_metering"]
    });
    mockedSetPixyFocusMetering.mockResolvedValue({
      ok: true,
      command: "focus_metering",
      value: "human_face",
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setFocusMeteringMode("human_face");
    });

    expect(mockedSetPixyFocusMetering).toHaveBeenCalledWith("human_face", undefined);
    expect(result.current.focusMeteringMode).toBe("human_face");
  });

  it("sends selected-area focus coordinates when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["focus_metering"]
    });
    mockedSetPixyFocusMetering.mockResolvedValue({
      ok: true,
      command: "focus_metering",
      value: "selected_area",
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setFocusMeteringMode("selected_area", { x: 12, y: 96 });
    });

    expect(mockedSetPixyFocusMetering).toHaveBeenCalledWith("selected_area", { x: 12, y: 96 });
    expect(result.current.focusMeteringMode).toBe("selected_area");
    expect(result.current.focusMeteringPoint).toEqual({ x: 12, y: 96 });
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

  it("sends captured HID PTZ vector commands when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["ptz_vector"]
    });
    mockedSendPixyPtzVector.mockResolvedValue({
      ok: true,
      command: "ptz_vector",
      value: "30,-30,0",
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendPtzVector({ x: 30, y: -30 });
    });

    expect(mockedSendPixyPtzVector).toHaveBeenCalledWith({ x: 30, y: -30 });
    expect(result.current.lastCommand).toBe("ptz-vector:30,-30,0");
  });

  it("sends captured HID PTZ preset save commands when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["ptz_preset_save"]
    });
    mockedSavePixyPtzPreset.mockResolvedValue({
      ok: true,
      command: "ptz_preset_save",
      value: 2,
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.savePtzPreset(2);
    });

    expect(mockedSavePixyPtzPreset).toHaveBeenCalledWith(2);
    expect(result.current.lastCommand).toBe("ptz-preset-save:2");
  });

  it("sends captured HID PTZ preset load commands when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["ptz_preset_load"]
    });
    mockedLoadPixyPtzPreset.mockResolvedValue({
      ok: true,
      command: "ptz_preset_load",
      value: 3,
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadPtzPreset(3);
    });

    expect(mockedLoadPixyPtzPreset).toHaveBeenCalledWith(3);
    expect(result.current.lastCommand).toBe("ptz-preset-load:3");
  });
});
