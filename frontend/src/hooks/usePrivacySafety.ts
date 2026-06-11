import { useCallback, useEffect, useState } from "react";

import type { UseAudioResult } from "./useAudio";
import type { UsePixyHidResult } from "./usePixyHid";
import { fetchSettings, updateSettings } from "../lib/apiClient";
import type { AppSettings, AppSettingsUpdate } from "../types/api";

let startupPrivacyCommandAttempted = false;

export type UsePrivacySafetyResult = {
  settings: AppSettings | null;
  settingsLoaded: boolean;
  startupPrivacyEnabled: boolean;
  startupPrivacyState: "loading" | "disabled" | "waiting-for-hid" | "sending" | "sent" | "failed";
  settingsError: string | null;
  settingsPending: boolean;
  refreshSettings: () => Promise<void>;
  saveSettings: (update: AppSettingsUpdate) => Promise<AppSettings>;
  enterPrivacy: () => Promise<void>;
  leavePrivacy: () => Promise<void>;
};

export function resetPrivacySafetyForTests() {
  startupPrivacyCommandAttempted = false;
}

export function usePrivacySafety(
  pixyHid: UsePixyHidResult,
  audio: UseAudioResult
): UsePrivacySafetyResult {
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsPending, setSettingsPending] = useState(false);
  const [startInPrivacy, setStartInPrivacy] = useState(true);
  const [startupPrivacyState, setStartupPrivacyState] =
    useState<UsePrivacySafetyResult["startupPrivacyState"]>("loading");

  const applySettings = useCallback((settings: AppSettings) => {
    setSettings(settings);
    setStartInPrivacy(settings.safety.start_in_privacy);
  }, []);

  const refreshSettings = useCallback(async () => {
    setSettingsError(null);
    try {
      applySettings(await fetchSettings());
    } catch (err) {
      setStartInPrivacy(true);
      setSettingsError(err instanceof Error ? err.message : "Unable to load settings");
    } finally {
      setSettingsLoaded(true);
    }
  }, [applySettings]);

  useEffect(() => {
    let ignore = false;

    async function loadSettings() {
      setSettingsError(null);
      try {
        const settings = await fetchSettings();
        if (!ignore) {
          applySettings(settings);
        }
      } catch (err) {
        if (!ignore) {
          setStartInPrivacy(true);
          setSettingsError(err instanceof Error ? err.message : "Unable to load settings");
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
  }, [applySettings]);

  const saveSettings = useCallback(
    async (update: AppSettingsUpdate) => {
      setSettingsPending(true);
      setSettingsError(null);
      try {
        const nextSettings = await updateSettings(update);
        applySettings(nextSettings);
        return nextSettings;
      } catch (err) {
        setSettingsError(err instanceof Error ? err.message : "Unable to save settings");
        throw err;
      } finally {
        setSettingsPending(false);
      }
    },
    [applySettings]
  );

  const enterPrivacy = useCallback(async () => {
    await pixyHid.setTrackingMode("privacy");
    await audio.setMuted(true);
  }, [audio.setMuted, pixyHid.setTrackingMode]);

  const leavePrivacy = useCallback(async () => {
    await pixyHid.setTrackingMode("off");
  }, [pixyHid.setTrackingMode]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (!startInPrivacy) {
      setStartupPrivacyState("disabled");
      return;
    }
    if (startupPrivacyCommandAttempted) {
      return;
    }
    if (pixyHid.status?.writable !== true) {
      setStartupPrivacyState("waiting-for-hid");
      return;
    }

    startupPrivacyCommandAttempted = true;
    setStartupPrivacyState("sending");
    void enterPrivacy()
      .then(() => setStartupPrivacyState("sent"))
      .catch(() => {
        startupPrivacyCommandAttempted = false;
        setStartupPrivacyState("failed");
      });
  }, [enterPrivacy, pixyHid.status?.writable, settingsLoaded, startInPrivacy]);

  return {
    settings,
    settingsLoaded,
    startupPrivacyEnabled: startInPrivacy,
    startupPrivacyState,
    settingsError,
    settingsPending,
    refreshSettings,
    saveSettings,
    enterPrivacy,
    leavePrivacy
  };
}
