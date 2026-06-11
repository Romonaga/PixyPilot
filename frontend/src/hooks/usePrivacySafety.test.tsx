import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSettings, updateSettings } from "../lib/apiClient";
import type { AppSettings } from "../types/api";
import type { UseAudioResult } from "./useAudio";
import type { UsePixyHidResult } from "./usePixyHid";
import { resetPrivacySafetyForTests, usePrivacySafety } from "./usePrivacySafety";

vi.mock("../lib/apiClient", () => ({
  fetchSettings: vi.fn(),
  updateSettings: vi.fn()
}));

const mockedFetchSettings = vi.mocked(fetchSettings);
const mockedUpdateSettings = vi.mocked(updateSettings);

function makeSettings(startInPrivacy: boolean): AppSettings {
  return {
    safety: { start_in_privacy: startInPrivacy },
    server: { host: "127.0.0.1", port: 8000, reload: false, url: "http://127.0.0.1:8000" },
    frontend: {
      dist_path: "/FastDrive/EmmetPixy/frontend/dist",
      dev_server_host: "127.0.0.1",
      dev_server_port: 5173,
      single_port: true
    },
    storage: {
      presets_path: "/FastDrive/EmmetPixy/config/presets.yaml",
      recordings_dir: "/FastDrive/EmmetPixy/recordings"
    },
    hid: { path: null, report_gap_ms: 25 },
    config: { path: "/FastDrive/EmmetPixy/config/pixypilot.yaml" }
  };
}

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
    deviceTrackingState: "unknown",
    deviceTrackingRawValue: null,
    deviceTrackingRawBits: [],
    targetTrackingMode: null,
    targetTrackingRawValue: null,
    gestureEnabled: null,
    autoRotateEnabled: null,
    mirrorMode: null,
    focusMeteringMode: null,
    focusMeteringPoint: null,
    audioMode: null,
    autoPrivacySeconds: null,
    refresh: vi.fn(),
    refreshStatus: vi.fn(),
    setTrackingMode: vi.fn().mockResolvedValue(undefined),
    setTargetTrackingMode: vi.fn(),
    setGestureEnabled: vi.fn(),
    setAutoRotateEnabled: vi.fn(),
    setMirrorMode: vi.fn(),
    setFocusMeteringMode: vi.fn(),
    setAudioMode: vi.fn(),
    setAutoPrivacySeconds: vi.fn(),
    sendPtzDirection: vi.fn(),
    sendPtzRelative: vi.fn(),
    sendPtzAbsolute: vi.fn(),
    sendPtzVector: vi.fn(),
    recenterPtz: vi.fn(),
    savePtzPreset: vi.fn(),
    loadPtzPreset: vi.fn(),
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
    mockedUpdateSettings.mockReset();
  });

  it("sends camera privacy and mic mute when entering privacy", async () => {
    mockedFetchSettings.mockResolvedValue(makeSettings(false));
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
    mockedFetchSettings.mockResolvedValue(makeSettings(true));
    const pixyHid = makePixyHid();
    const audio = makeAudio();

    const { result } = renderHook(() => usePrivacySafety(pixyHid, audio));

    await waitFor(() => expect(pixyHid.setTrackingMode).toHaveBeenCalledWith("privacy"));
    await waitFor(() => expect(audio.setMuted).toHaveBeenCalledWith(true));
    expect(result.current.startupPrivacyEnabled).toBe(true);
    expect(result.current.startupPrivacyState).toBe("sent");
  });

  it("reports startup privacy as sending until the command finishes", async () => {
    mockedFetchSettings.mockResolvedValue(makeSettings(true));
    let finishPrivacy!: () => void;
    const setTrackingMode = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPrivacy = resolve;
        })
    );
    const pixyHid = makePixyHid({ setTrackingMode });
    const audio = makeAudio();

    const { result } = renderHook(() => usePrivacySafety(pixyHid, audio));

    await waitFor(() => expect(setTrackingMode).toHaveBeenCalledWith("privacy"));
    expect(result.current.startupPrivacyState).toBe("sending");

    await act(async () => {
      finishPrivacy();
    });

    await waitFor(() => expect(result.current.startupPrivacyState).toBe("sent"));
  });

  it("does not start in privacy when the safety setting is disabled", async () => {
    mockedFetchSettings.mockResolvedValue(makeSettings(false));
    const pixyHid = makePixyHid();
    const audio = makeAudio();

    const { result } = renderHook(() => usePrivacySafety(pixyHid, audio));

    await waitFor(() => expect(mockedFetchSettings).toHaveBeenCalled());

    expect(pixyHid.setTrackingMode).not.toHaveBeenCalled();
    expect(audio.setMuted).not.toHaveBeenCalled();
    expect(result.current.startupPrivacyEnabled).toBe(false);
    expect(result.current.startupPrivacyState).toBe("disabled");
  });

  it("leaves privacy without unmuting the mic", async () => {
    mockedFetchSettings.mockResolvedValue(makeSettings(false));
    const pixyHid = makePixyHid();
    const audio = makeAudio();

    const { result } = renderHook(() => usePrivacySafety(pixyHid, audio));

    await act(async () => {
      await result.current.leavePrivacy();
    });

    expect(pixyHid.setTrackingMode).toHaveBeenCalledWith("off");
    expect(audio.setMuted).not.toHaveBeenCalled();
  });

  it("saves runtime settings and updates the current settings state", async () => {
    mockedFetchSettings.mockResolvedValue(makeSettings(false));
    mockedUpdateSettings.mockResolvedValue(makeSettings(true));
    const pixyHid = makePixyHid();
    const audio = makeAudio();

    const { result } = renderHook(() => usePrivacySafety(pixyHid, audio));

    await waitFor(() => expect(result.current.settingsLoaded).toBe(true));

    await act(async () => {
      await result.current.saveSettings({ safety: { start_in_privacy: true } });
    });

    expect(mockedUpdateSettings).toHaveBeenCalledWith({ safety: { start_in_privacy: true } });
    expect(result.current.settings?.safety.start_in_privacy).toBe(true);
    expect(result.current.startupPrivacyEnabled).toBe(true);
  });
});
