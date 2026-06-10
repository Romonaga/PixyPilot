import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSettings } from "../lib/apiClient";
import type { UseAudioResult } from "./useAudio";
import type { UsePixyHidResult } from "./usePixyHid";
import { resetPrivacySafetyForTests, usePrivacySafety } from "./usePrivacySafety";

vi.mock("../lib/apiClient", () => ({
  fetchSettings: vi.fn()
}));

const mockedFetchSettings = vi.mocked(fetchSettings);

function makePixyHid(overrides: Partial<UsePixyHidResult> = {}): UsePixyHidResult {
  return {
    status: {
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["tracking", "privacy"]
    },
    isLoading: false,
    pendingCommand: null,
    error: null,
    lastCommand: null,
    trackingMode: null,
    gestureEnabled: null,
    autoRotateEnabled: null,
    mirrorMode: null,
    audioMode: null,
    autoPrivacySeconds: null,
    refresh: vi.fn(),
    setTrackingMode: vi.fn().mockResolvedValue(undefined),
    setGestureEnabled: vi.fn(),
    setAutoRotateEnabled: vi.fn(),
    setMirrorMode: vi.fn(),
    setAudioMode: vi.fn(),
    setAutoPrivacySeconds: vi.fn(),
    sendPtzDirection: vi.fn(),
    sendPtzVector: vi.fn(),
    ...overrides
  };
}

function makeAudio(overrides: Partial<UseAudioResult> = {}): UseAudioResult {
  return {
    status: {
      available: true,
      card: 3,
      name: "EMEET PIXY",
      muted: false,
      volume: 10,
      reason: null
    },
    isLoading: false,
    pending: false,
    error: null,
    refresh: vi.fn(),
    setMuted: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("usePrivacySafety", () => {
  beforeEach(() => {
    resetPrivacySafetyForTests();
    mockedFetchSettings.mockReset();
  });

  it("sends camera privacy and mic mute when entering privacy", async () => {
    mockedFetchSettings.mockResolvedValue({ safety: { start_in_privacy: false } });
    const pixyHid = makePixyHid();
    const audio = makeAudio();

    const { result } = renderHook(() => usePrivacySafety(pixyHid, audio));

    await act(async () => {
      await result.current.enterPrivacy();
    });

    expect(pixyHid.setTrackingMode).toHaveBeenCalledWith("privacy");
    expect(audio.setMuted).toHaveBeenCalledWith(true);
  });

  it("starts in privacy and mutes the mic when the safety setting is enabled", async () => {
    mockedFetchSettings.mockResolvedValue({ safety: { start_in_privacy: true } });
    const pixyHid = makePixyHid();
    const audio = makeAudio();

    renderHook(() => usePrivacySafety(pixyHid, audio));

    await waitFor(() => expect(pixyHid.setTrackingMode).toHaveBeenCalledWith("privacy"));
    await waitFor(() => expect(audio.setMuted).toHaveBeenCalledWith(true));
  });

  it("does not start in privacy when the safety setting is disabled", async () => {
    mockedFetchSettings.mockResolvedValue({ safety: { start_in_privacy: false } });
    const pixyHid = makePixyHid();
    const audio = makeAudio();

    renderHook(() => usePrivacySafety(pixyHid, audio));

    await waitFor(() => expect(mockedFetchSettings).toHaveBeenCalled());

    expect(pixyHid.setTrackingMode).not.toHaveBeenCalled();
    expect(audio.setMuted).not.toHaveBeenCalled();
  });

  it("leaves privacy without unmuting the mic", async () => {
    mockedFetchSettings.mockResolvedValue({ safety: { start_in_privacy: false } });
    const pixyHid = makePixyHid();
    const audio = makeAudio();

    const { result } = renderHook(() => usePrivacySafety(pixyHid, audio));

    await act(async () => {
      await result.current.leavePrivacy();
    });

    expect(pixyHid.setTrackingMode).toHaveBeenCalledWith("off");
    expect(audio.setMuted).not.toHaveBeenCalled();
  });
});
