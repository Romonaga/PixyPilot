import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchPixyHidState,
  fetchPixyHidStatus,
  setPixyAudio,
  setPixyAutoPrivacy,
  setPixyAutoRotate,
  setPixyGesture,
  setPixyFocusMetering,
  setPixyMirror,
  loadPixyPtzPreset,
  recenterPixyPtz,
  savePixyPtzPreset,
  sendPixyPtzDirection,
  sendPixyPtzRelative,
  sendPixyPtzVector,
  setPixyTargetTracking,
  setPixyTracking
} from "../lib/apiClient";
import { usePixyHid } from "./usePixyHid";

vi.mock("../lib/apiClient", () => ({
  fetchPixyHidState: vi.fn(),
  fetchPixyHidStatus: vi.fn(),
  setPixyAudio: vi.fn(),
  setPixyAutoPrivacy: vi.fn(),
  setPixyAutoRotate: vi.fn(),
  setPixyGesture: vi.fn(),
  setPixyFocusMetering: vi.fn(),
  setPixyMirror: vi.fn(),
  loadPixyPtzPreset: vi.fn(),
  recenterPixyPtz: vi.fn(),
  savePixyPtzPreset: vi.fn(),
  sendPixyPtzDirection: vi.fn(),
  sendPixyPtzRelative: vi.fn(),
  sendPixyPtzVector: vi.fn(),
  setPixyTargetTracking: vi.fn(),
  setPixyTracking: vi.fn()
}));

const mockedFetchPixyHidState = vi.mocked(fetchPixyHidState);
const mockedFetchPixyHidStatus = vi.mocked(fetchPixyHidStatus);
const mockedSetPixyAudio = vi.mocked(setPixyAudio);
const mockedSetPixyAutoPrivacy = vi.mocked(setPixyAutoPrivacy);
const mockedSetPixyAutoRotate = vi.mocked(setPixyAutoRotate);
const mockedSetPixyGesture = vi.mocked(setPixyGesture);
const mockedSetPixyFocusMetering = vi.mocked(setPixyFocusMetering);
const mockedSetPixyMirror = vi.mocked(setPixyMirror);
const mockedLoadPixyPtzPreset = vi.mocked(loadPixyPtzPreset);
const mockedRecenterPixyPtz = vi.mocked(recenterPixyPtz);
const mockedSavePixyPtzPreset = vi.mocked(savePixyPtzPreset);
const mockedSendPixyPtzDirection = vi.mocked(sendPixyPtzDirection);
const mockedSendPixyPtzRelative = vi.mocked(sendPixyPtzRelative);
const mockedSendPixyPtzVector = vi.mocked(sendPixyPtzVector);
const mockedSetPixyTargetTracking = vi.mocked(setPixyTargetTracking);
const mockedSetPixyTracking = vi.mocked(setPixyTracking);

describe("usePixyHid", () => {
  beforeEach(() => {
    mockedFetchPixyHidState.mockReset();
    mockedFetchPixyHidStatus.mockReset();
    mockedSetPixyAudio.mockReset();
    mockedSetPixyAutoPrivacy.mockReset();
    mockedSetPixyAutoRotate.mockReset();
    mockedSetPixyGesture.mockReset();
    mockedSetPixyFocusMetering.mockReset();
    mockedSetPixyMirror.mockReset();
    mockedLoadPixyPtzPreset.mockReset();
    mockedRecenterPixyPtz.mockReset();
    mockedSavePixyPtzPreset.mockReset();
    mockedSendPixyPtzDirection.mockReset();
    mockedSendPixyPtzRelative.mockReset();
    mockedSendPixyPtzVector.mockReset();
    mockedSetPixyTargetTracking.mockReset();
    mockedSetPixyTracking.mockReset();
  });

  function mockDeviceState(rawValue: number | null = 3, rawBits: number[] = [0, 1]) {
    mockedFetchPixyHidState.mockResolvedValue({
      tracking_mode: rawValue === 2 ? "privacy" : null,
      tracking_raw_value: rawValue,
      tracking_raw_bits: rawBits,
      target_tracking_mode: rawValue === 2 ? null : "face",
      target_tracking_raw_value: rawValue === 2 ? null : 1,
      target_tracking_x: 0.5,
      target_tracking_y: 0.5,
      target_tracking_scale: 1,
      audio_mode: null,
      audio_raw_value: null,
      gesture_enabled: null,
      gesture_raw_value: null,
      queries: {},
      path: "/dev/hidraw14"
    });
  }

  it("loads HID status without sending startup commands", async () => {
    mockDeviceState();
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
    expect(result.current.deviceTrackingState).toBe("non_privacy");
  });

  it("sends tracking commands when requested", async () => {
    mockDeviceState(2, [1]);
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
    expect(result.current.deviceTrackingState).toBe("privacy");
  });

  it("keeps tracking as last commanded when device readback only says non-privacy", async () => {
    mockDeviceState(3, [0, 1]);
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
      value: "tracking",
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setTrackingMode("tracking");
    });

    expect(result.current.trackingMode).toBe("tracking");
    expect(result.current.deviceTrackingState).toBe("non_privacy");
    expect(result.current.deviceTrackingRawValue).toBe(3);
  });

  it("sends target tracking mode commands when requested", async () => {
    mockDeviceState(3, [0, 1]);
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["target_tracking"]
    });
    mockedSetPixyTargetTracking.mockResolvedValue({
      ok: true,
      command: "target_tracking",
      value: "full_body",
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setTargetTrackingMode("full_body");
    });

    expect(mockedSetPixyTargetTracking).toHaveBeenCalledWith("full_body");
    expect(result.current.trackingMode).toBe("tracking");
    expect(result.current.targetTrackingMode).toBe("face");
  });

  it("clears locally asserted HID state when HID status is refreshed", async () => {
    mockDeviceState(3, [0, 1]);
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
    expect(result.current.trackingMode).toBeNull();

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.trackingMode).toBeNull();
    expect(result.current.deviceTrackingState).toBe("non_privacy");
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

  it("sends degree-based HID PTZ relative commands when requested", async () => {
    mockedFetchPixyHidStatus.mockResolvedValue({
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["ptz_relative"]
    });
    mockedSendPixyPtzRelative.mockResolvedValue({
      ok: true,
      command: "ptz_relative",
      value: "left:3",
      path: "/dev/hidraw14"
    });

    const { result } = renderHook(() => usePixyHid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendPtzRelative("left", 3);
    });

    expect(mockedSendPixyPtzRelative).toHaveBeenCalledWith("left", 3);
    expect(result.current.lastCommand).toBe("ptz-relative:left:3");
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
