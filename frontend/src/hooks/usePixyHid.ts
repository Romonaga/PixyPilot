import { useCallback, useEffect, useState } from "react";

import {
  fetchPixyHidStatus,
  setPixyAudio,
  setPixyAutoPrivacy,
  setPixyAutoRotate,
  setPixyGesture,
  setPixyFocusMetering,
  setPixyMirror,
  loadPixyPtzPreset,
  sendPixyPtzDirection,
  sendPixyPtzVector,
  savePixyPtzPreset,
  setPixyTracking
} from "../lib/apiClient";
import type {
  AudioMode,
  FocusMeteringPoint,
  FocusMeteringMode,
  MirrorMode,
  PixyHidStatus,
  PtzDirection,
  PtzPresetSlot,
  PtzVector,
  TrackingMode
} from "../types/api";

export type UsePixyHidResult = {
  status: PixyHidStatus | null;
  isLoading: boolean;
  pendingCommand: string | null;
  error: string | null;
  lastCommand: string | null;
  trackingMode: TrackingMode | null;
  gestureEnabled: boolean | null;
  autoRotateEnabled: boolean | null;
  mirrorMode: MirrorMode | null;
  focusMeteringMode: FocusMeteringMode | null;
  focusMeteringPoint: FocusMeteringPoint | null;
  audioMode: AudioMode | null;
  autoPrivacySeconds: number | null;
  refresh: () => Promise<void>;
  setTrackingMode: (mode: TrackingMode) => Promise<void>;
  setGestureEnabled: (enabled: boolean) => Promise<void>;
  setAutoRotateEnabled: (enabled: boolean) => Promise<void>;
  setMirrorMode: (mode: MirrorMode) => Promise<void>;
  setFocusMeteringMode: (mode: FocusMeteringMode, point?: FocusMeteringPoint) => Promise<void>;
  setAudioMode: (mode: AudioMode) => Promise<void>;
  setAutoPrivacySeconds: (seconds: number) => Promise<void>;
  sendPtzDirection: (direction: PtzDirection) => Promise<void>;
  sendPtzVector: (vector: PtzVector) => Promise<void>;
  savePtzPreset: (slot: PtzPresetSlot) => Promise<void>;
  loadPtzPreset: (slot: PtzPresetSlot) => Promise<void>;
};

export function usePixyHid(): UsePixyHidResult {
  const [status, setStatus] = useState<PixyHidStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [trackingMode, setTrackingModeState] = useState<TrackingMode | null>(null);
  const [gestureEnabled, setGestureEnabledState] = useState<boolean | null>(null);
  const [autoRotateEnabled, setAutoRotateEnabledState] = useState<boolean | null>(null);
  const [mirrorMode, setMirrorModeState] = useState<MirrorMode | null>(null);
  const [focusMeteringMode, setFocusMeteringModeState] = useState<FocusMeteringMode | null>(null);
  const [focusMeteringPoint, setFocusMeteringPointState] = useState<FocusMeteringPoint | null>(null);
  const [audioMode, setAudioModeState] = useState<AudioMode | null>(null);
  const [autoPrivacySeconds, setAutoPrivacySecondsState] = useState<number | null>(null);

  const clearAssertedState = useCallback(() => {
    setTrackingModeState(null);
    setGestureEnabledState(null);
    setAutoRotateEnabledState(null);
    setMirrorModeState(null);
    setFocusMeteringModeState(null);
    setFocusMeteringPointState(null);
    setAudioModeState(null);
    setAutoPrivacySecondsState(null);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    clearAssertedState();
    try {
      setStatus(await fetchPixyHidStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to inspect Pixy HID");
    } finally {
      setIsLoading(false);
    }
  }, [clearAssertedState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const setAutoRotateEnabled = useCallback(
    async (enabled: boolean) =>
      runCommand(`auto-rotate:${enabled ? "on" : "off"}`, async () => {
        await setPixyAutoRotate(enabled);
        setAutoRotateEnabledState(enabled);
      }),
    [runCommand]
  );

  const setMirrorMode = useCallback(
    async (mode: MirrorMode) =>
      runCommand(`mirror:${mode}`, async () => {
        await setPixyMirror(mode);
        setMirrorModeState(mode);
      }),
    [runCommand]
  );

  const setFocusMeteringMode = useCallback(
    async (mode: FocusMeteringMode, point?: FocusMeteringPoint) =>
      runCommand(`focus-metering:${mode}${point ? `:${point.x},${point.y}` : ""}`, async () => {
        await setPixyFocusMetering(mode, point);
        setFocusMeteringModeState(mode);
        setFocusMeteringPointState(point ?? null);
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

  const sendPtzDirection = useCallback(
    async (direction: PtzDirection) =>
      runCommand(`ptz:${direction}`, async () => {
        await sendPixyPtzDirection(direction);
      }),
    [runCommand]
  );

  const sendPtzVector = useCallback(
    async (vector: PtzVector) =>
      runCommand(`ptz-vector:${vector.x},${vector.y},${vector.z ?? 0}`, async () => {
        await sendPixyPtzVector(vector);
      }),
    [runCommand]
  );

  const savePtzPreset = useCallback(
    async (slot: PtzPresetSlot) =>
      runCommand(`ptz-preset-save:${slot}`, async () => {
        await savePixyPtzPreset(slot);
      }),
    [runCommand]
  );

  const loadPtzPreset = useCallback(
    async (slot: PtzPresetSlot) =>
      runCommand(`ptz-preset-load:${slot}`, async () => {
        await loadPixyPtzPreset(slot);
      }),
    [runCommand]
  );

  return {
    status,
    isLoading,
    pendingCommand,
    error,
    lastCommand,
    trackingMode,
    gestureEnabled,
    autoRotateEnabled,
    mirrorMode,
    focusMeteringMode,
    focusMeteringPoint,
    audioMode,
    autoPrivacySeconds,
    refresh,
    setTrackingMode,
    setGestureEnabled,
    setAutoRotateEnabled,
    setMirrorMode,
    setFocusMeteringMode,
    setAudioMode,
    setAutoPrivacySeconds,
    sendPtzDirection,
    sendPtzVector,
    savePtzPreset,
    loadPtzPreset
  };
}
