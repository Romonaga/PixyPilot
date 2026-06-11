import { useCallback, useEffect, useState } from "react";

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
  sendPixyPtzDirection,
  sendPixyPtzAbsolute,
  sendPixyPtzRelative,
  sendPixyPtzVector,
  savePixyPtzPreset,
  setPixyTargetTracking,
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
  TargetTrackingMode,
  TrackingMode
} from "../types/api";

export type DeviceTrackingState = "privacy" | "non_privacy" | "unknown";

const NON_PRIVACY_READBACK_RETRIES = 4;
const NON_PRIVACY_READBACK_RETRY_MS = 250;

export type UsePixyHidResult = {
  status: PixyHidStatus | null;
  isLoading: boolean;
  pendingCommand: string | null;
  error: string | null;
  lastCommand: string | null;
  trackingMode: TrackingMode | null;
  deviceTrackingState: DeviceTrackingState;
  deviceTrackingRawValue: number | null;
  deviceTrackingRawBits: number[];
  targetTrackingMode: TargetTrackingMode | null;
  targetTrackingRawValue: number | null;
  gestureEnabled: boolean | null;
  autoRotateEnabled: boolean | null;
  mirrorMode: MirrorMode | null;
  focusMeteringMode: FocusMeteringMode | null;
  focusMeteringPoint: FocusMeteringPoint | null;
  audioMode: AudioMode | null;
  autoPrivacySeconds: number | null;
  refresh: () => Promise<void>;
  refreshStatus: (options?: { showLoading?: boolean }) => Promise<void>;
  setTrackingMode: (mode: TrackingMode) => Promise<void>;
  setTargetTrackingMode: (mode: TargetTrackingMode) => Promise<void>;
  setGestureEnabled: (enabled: boolean) => Promise<void>;
  setAutoRotateEnabled: (enabled: boolean) => Promise<void>;
  setMirrorMode: (mode: MirrorMode) => Promise<void>;
  setFocusMeteringMode: (mode: FocusMeteringMode, point?: FocusMeteringPoint) => Promise<void>;
  setAudioMode: (mode: AudioMode) => Promise<void>;
  setAutoPrivacySeconds: (seconds: number) => Promise<void>;
  sendPtzDirection: (direction: PtzDirection) => Promise<void>;
  sendPtzRelative: (direction: PtzDirection, degrees: number) => Promise<void>;
  sendPtzAbsolute: (pan: number, tilt: number) => Promise<void>;
  sendPtzVector: (vector: PtzVector) => Promise<void>;
  recenterPtz: () => Promise<void>;
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
  const [deviceTrackingState, setDeviceTrackingState] = useState<DeviceTrackingState>("unknown");
  const [deviceTrackingRawValue, setDeviceTrackingRawValue] = useState<number | null>(null);
  const [deviceTrackingRawBits, setDeviceTrackingRawBits] = useState<number[]>([]);
  const [targetTrackingMode, setTargetTrackingModeState] = useState<TargetTrackingMode | null>(null);
  const [targetTrackingRawValue, setTargetTrackingRawValue] = useState<number | null>(null);
  const [gestureEnabled, setGestureEnabledState] = useState<boolean | null>(null);
  const [autoRotateEnabled, setAutoRotateEnabledState] = useState<boolean | null>(null);
  const [mirrorMode, setMirrorModeState] = useState<MirrorMode | null>(null);
  const [focusMeteringMode, setFocusMeteringModeState] = useState<FocusMeteringMode | null>(null);
  const [focusMeteringPoint, setFocusMeteringPointState] = useState<FocusMeteringPoint | null>(null);
  const [audioMode, setAudioModeState] = useState<AudioMode | null>(null);
  const [autoPrivacySeconds, setAutoPrivacySecondsState] = useState<number | null>(null);

  const clearAssertedState = useCallback(() => {
    setTrackingModeState(null);
    setDeviceTrackingState("unknown");
    setDeviceTrackingRawValue(null);
    setDeviceTrackingRawBits([]);
    setTargetTrackingModeState(null);
    setTargetTrackingRawValue(null);
    setGestureEnabledState(null);
    setAutoRotateEnabledState(null);
    setMirrorModeState(null);
    setFocusMeteringModeState(null);
    setFocusMeteringPointState(null);
    setAudioModeState(null);
    setAutoPrivacySecondsState(null);
  }, []);

  const refreshDeviceState = useCallback(async (options: { expectNonPrivacy?: boolean } = {}) => {
    try {
      const attempts = options.expectNonPrivacy ? NON_PRIVACY_READBACK_RETRIES : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const deviceState = await fetchPixyHidState();
        const rawValue = deviceState.tracking_raw_value;
        if (options.expectNonPrivacy && rawValue === 2 && attempt < attempts - 1) {
          await delay(NON_PRIVACY_READBACK_RETRY_MS);
          continue;
        }
        setDeviceTrackingRawValue(rawValue);
        setDeviceTrackingRawBits(deviceState.tracking_raw_bits);
        setTargetTrackingModeState(deviceState.target_tracking_mode);
        setTargetTrackingRawValue(deviceState.target_tracking_raw_value);
        if (rawValue === 2) {
          setDeviceTrackingState("privacy");
          setTrackingModeState("privacy");
          return;
        }
        if (rawValue === 3) {
          setDeviceTrackingState("non_privacy");
          setTrackingModeState((current) => (current === "privacy" ? null : current));
          return;
        }
        setDeviceTrackingState("unknown");
        return;
      }
    } catch {
      setDeviceTrackingState("unknown");
      setDeviceTrackingRawValue(null);
      setDeviceTrackingRawBits([]);
      setTargetTrackingModeState(null);
      setTargetTrackingRawValue(null);
    }
  }, []);

  const refreshStatusInternal = useCallback(async (options: { clearState?: boolean; showLoading?: boolean } = {}) => {
    if (options.showLoading !== false) {
      setIsLoading(true);
    }
    setError(null);
    if (options.clearState) {
      clearAssertedState();
    }
    try {
      const nextStatus = await fetchPixyHidStatus();
      setStatus(nextStatus);
      if (nextStatus.writable) {
        await refreshDeviceState();
      } else {
        setDeviceTrackingState("unknown");
        setDeviceTrackingRawValue(null);
        setDeviceTrackingRawBits([]);
        setTargetTrackingModeState(null);
        setTargetTrackingRawValue(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to inspect Pixy HID");
    } finally {
      setIsLoading(false);
    }
  }, [clearAssertedState, refreshDeviceState]);

  const refreshStatus = useCallback(async (options: { showLoading?: boolean } = {}) => {
    await refreshStatusInternal({ clearState: false, showLoading: options.showLoading });
  }, [refreshStatusInternal]);

  const refresh = useCallback(async () => {
    await refreshStatusInternal({ clearState: true, showLoading: true });
  }, [refreshStatusInternal]);

  useEffect(() => {
    void refreshStatus({ showLoading: true });
  }, [refreshStatus]);

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
        await refreshDeviceState({ expectNonPrivacy: mode !== "privacy" });
      }),
    [refreshDeviceState, runCommand]
  );

  const setGestureEnabled = useCallback(
    async (enabled: boolean) =>
      runCommand(`gesture:${enabled ? "on" : "off"}`, async () => {
        await setPixyGesture(enabled);
        setGestureEnabledState(enabled);
      }),
    [runCommand]
  );

  const setTargetTrackingMode = useCallback(
    async (mode: TargetTrackingMode) =>
      runCommand(`target-tracking:${mode}`, async () => {
        await setPixyTargetTracking(mode);
        setTrackingModeState(mode === "off" ? "off" : "tracking");
        setTargetTrackingModeState(mode);
        await refreshDeviceState({ expectNonPrivacy: mode !== "off" });
      }),
    [refreshDeviceState, runCommand]
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

  const sendPtzRelative = useCallback(
    async (direction: PtzDirection, degrees: number) =>
      runCommand(`ptz-relative:${direction}:${degrees}`, async () => {
        await sendPixyPtzRelative(direction, degrees);
      }),
    [runCommand]
  );

  const sendPtzAbsolute = useCallback(
    async (pan: number, tilt: number) =>
      runCommand(`ptz-absolute:${pan},${tilt}`, async () => {
        await sendPixyPtzAbsolute(pan, tilt);
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

  const recenterPtz = useCallback(
    async () =>
      runCommand("ptz-recenter", async () => {
        await recenterPixyPtz();
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
    deviceTrackingState,
    deviceTrackingRawValue,
    deviceTrackingRawBits,
    targetTrackingMode,
    targetTrackingRawValue,
    gestureEnabled,
    autoRotateEnabled,
    mirrorMode,
    focusMeteringMode,
    focusMeteringPoint,
    audioMode,
    autoPrivacySeconds,
    refresh,
    refreshStatus,
    setTrackingMode,
    setTargetTrackingMode,
    setGestureEnabled,
    setAutoRotateEnabled,
    setMirrorMode,
    setFocusMeteringMode,
    setAudioMode,
    setAutoPrivacySeconds,
    sendPtzDirection,
    sendPtzRelative,
    sendPtzAbsolute,
    sendPtzVector,
    recenterPtz,
    savePtzPreset,
    loadPtzPreset
  };
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
