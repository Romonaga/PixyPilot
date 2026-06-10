import { useCallback, useEffect, useState } from "react";

import type { UseAudioResult } from "./useAudio";
import type { UsePixyHidResult } from "./usePixyHid";
import { fetchSettings } from "../lib/apiClient";
import type { AppSettings } from "../types/api";

let startupPrivacyCommandAttempted = false;

export type UsePrivacySafetyResult = {
  settings: AppSettings | null;
  settingsLoaded: boolean;
  startupPrivacyEnabled: boolean;
  startupPrivacyState: "loading" | "disabled" | "waiting-for-hid" | "sending" | "sent" | "failed";
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
  const [startInPrivacy, setStartInPrivacy] = useState(true);
  const [startupPrivacyState, setStartupPrivacyState] =
    useState<UsePrivacySafetyResult["startupPrivacyState"]>("loading");

  useEffect(() => {
    let ignore = false;

    async function loadSettings() {
      try {
        const settings = await fetchSettings();
        if (!ignore) {
          setSettings(settings);
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
    enterPrivacy,
    leavePrivacy
  };
}
