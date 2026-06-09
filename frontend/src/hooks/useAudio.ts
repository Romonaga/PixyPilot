import { useCallback, useEffect, useState } from "react";

import { fetchAudioStatus, setAudioMute } from "../lib/apiClient";
import type { AudioStatus } from "../types/api";

export type UseAudioResult = {
  status: AudioStatus | null;
  isLoading: boolean;
  pending: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
};

export function useAudio(): UseAudioResult {
  const [status, setStatus] = useState<AudioStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus(await fetchAudioStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to inspect PIXY audio");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setMuted = useCallback(async (muted: boolean) => {
    setPending(true);
    setError(null);
    const previousStatus = status;
    setStatus((current) => (current ? { ...current, muted } : current));
    try {
      await setAudioMute(muted);
    } catch (err) {
      setStatus(previousStatus);
      setError(err instanceof Error ? err.message : "Unable to set PIXY mute");
    } finally {
      setPending(false);
    }
  }, [status]);

  return { status, isLoading, pending, error, refresh, setMuted };
}
