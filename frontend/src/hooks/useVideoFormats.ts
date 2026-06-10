import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchVideoFormats, setVideoFormat } from "../lib/apiClient";
import type { VideoFormatOption } from "../types/api";

export type UseVideoFormatsResult = {
  formats: VideoFormatOption[];
  selectedFormat: VideoFormatOption | null;
  selectedKey: string;
  isLoading: boolean;
  pending: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setSelectedKey: (key: string) => Promise<void>;
};

export function formatKey(format: Pick<VideoFormatOption, "pixel_format" | "width" | "height" | "fps">): string {
  return `${format.pixel_format}:${format.width}:${format.height}:${format.fps}`;
}

export function useVideoFormats(deviceName: string | null): UseVideoFormatsResult {
  const [formats, setFormats] = useState<VideoFormatOption[]>([]);
  const [selectedKey, setSelectedKeyState] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFormat = useMemo(
    () => formats.find((format) => formatKey(format) === selectedKey) ?? null,
    [formats, selectedKey]
  );

  const refresh = useCallback(async () => {
    if (!deviceName) {
      setFormats([]);
      setSelectedKeyState("");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await fetchVideoFormats(deviceName);
      setFormats(loaded);
      setSelectedKeyState((current) =>
        current && loaded.some((format) => formatKey(format) === current)
          ? current
          : loaded[0]
            ? formatKey(loaded[0])
            : ""
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load video formats");
    } finally {
      setIsLoading(false);
    }
  }, [deviceName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSelectedKey = useCallback(
    async (key: string) => {
      if (!deviceName) {
        return;
      }
      const selected = formats.find((format) => formatKey(format) === key);
      if (!selected) {
        return;
      }
      setPending(true);
      setError(null);
      try {
        const updated = await setVideoFormat(deviceName, selected);
        setSelectedKeyState(formatKey(updated));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to set video format");
      } finally {
        setPending(false);
      }
    },
    [deviceName, formats]
  );

  return {
    formats,
    selectedFormat,
    selectedKey,
    isLoading,
    pending,
    error,
    refresh,
    setSelectedKey
  };
}
