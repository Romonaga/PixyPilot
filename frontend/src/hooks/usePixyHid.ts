import { useCallback, useEffect, useState } from "react";

import {
  fetchSettings,
  fetchPixyHidStatus,
  setPixyAudio,
  setPixyAutoPrivacy,
  setPixyGesture,
  setPixyTracking
} from "../lib/apiClient";
import type { AudioMode, PixyHidStatus, TrackingMode } from "../types/api";

let startupPrivacyCommandAttempted = false;

export type UsePixyHidResult = {
  status: PixyHidStatus | null;
  isLoading: boolean;
  pendingCommand: string | null;
  error: string | null;
  lastCommand: string | null;
  trackingMode: TrackingMode | null;
  gestureEnabled: boolean | null;
  audioMode: AudioMode | null;
  autoPrivacySeconds: number | null;
  refresh: () => Promise<void>;
  setTrackingMode: (mode: TrackingMode) => Promise<void>;
  setGestureEnabled: (enabled: boolean) => Promise<void>;
  setAudioMode: (mode: AudioMode) => Promise<void>;
  setAutoPrivacySeconds: (seconds: number) => Promise<void>;
};

export function resetPixyHidStartupSafetyForTests() {
  startupPrivacyCommandAttempted = false;
}

export function usePixyHid(): UsePixyHidResult {
  const [status, setStatus] = useState<PixyHidStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [trackingMode, setTrackingModeState] = useState<TrackingMode | null>(null);
  const [gestureEnabled, setGestureEnabledState] = useState<boolean | null>(null);
  const [audioMode, setAudioModeState] = useState<AudioMode | null>(null);
  const [autoPrivacySeconds, setAutoPrivacySecondsState] = useState<number | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [startInPrivacy, setStartInPrivacy] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus(await fetchPixyHidStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to inspect Pixy HID");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let ignore = false;

    async function loadSettings() {
      try {
        const settings = await fetchSettings();
        if (!ignore) {
          setStartInPrivacy(settings.safety.start_in_privacy);
        }
      } catch {
        if (!ignore) {
          setStartInPrivacy(true);
        }
      } finally {
        if (!ignore) {
          setSettingsLoaded(true);
        }
      }
    }

    void loadSettings();
    return () => {
      ignore = true;
    };
  }, []);

  const runCommand = useCallback(
    async (command: string, action: () => Promise<void>) => {
      setPendingCommand(command);
      setError(null);
      try {
        await action();
        setLastCommand(command);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to run Pixy HID command");
      } finally {
        setPendingCommand(null);
      }
    },
    []
  );

  const setTrackingMode = useCallback(
    async (mode: TrackingMode) =>
      runCommand(`tracking:${mode}`, async () => {
        await setPixyTracking(mode);
        setTrackingModeState(mode);
      }),
    [runCommand]
  );

  const setGestureEnabled = useCallback(
    async (enabled: boolean) =>
      runCommand(`gesture:${enabled ? "on" : "off"}`, async () => {
        await setPixyGesture(enabled);
        setGestureEnabledState(enabled);
      }),
    [runCommand]
  );

  const setAudioMode = useCallback(
    async (mode: AudioMode) =>
      runCommand(`audio:${mode}`, async () => {
        await setPixyAudio(mode);
        setAudioModeState(mode);
      }),
    [runCommand]
  );

  const setAutoPrivacySeconds = useCallback(
    async (seconds: number) =>
      runCommand(`auto-privacy:${seconds}`, async () => {
        await setPixyAutoPrivacy(seconds);
        setAutoPrivacySecondsState(seconds);
      }),
    [runCommand]
  );

  useEffect(() => {
    if (!settingsLoaded || !startInPrivacy || startupPrivacyCommandAttempted || status?.writable !== true) {
      return;
    }

    startupPrivacyCommandAttempted = true;
    void setTrackingMode("privacy");
  }, [setTrackingMode, settingsLoaded, startInPrivacy, status?.writable]);

  return {
    status,
    isLoading,
    pendingCommand,
    error,
    lastCommand,
    trackingMode,
    gestureEnabled,
    audioMode,
    autoPrivacySeconds,
    refresh,
    setTrackingMode,
    setGestureEnabled,
    setAudioMode,
    setAutoPrivacySeconds
  };
}
