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

export function formatKey(
  format: Pick<VideoFormatOption, "pixel_format" | "width" | "height" | "fps" | "frame_interval_100ns">
): string {
  return `${format.pixel_format}:${format.width}:${format.height}:${format.frame_interval_100ns ?? format.fps}`;
}

export function defaultPreviewFormat(formats: VideoFormatOption[]): VideoFormatOption | null {
  const preferred = [
    { pixel_format: "MJPG", width: 1280, height: 720, fps: 30 },
    { pixel_format: "MJPG", width: 1920, height: 1080, fps: 30 },
    { pixel_format: "MJPG", width: 1280, height: 720, fps: 60 },
  ];
  for (const target of preferred) {
    const match = formats.find(
      (format) =>
        format.pixel_format === target.pixel_format &&
        format.width === target.width &&
        format.height === target.height &&
        Math.abs(format.fps - target.fps) < 0.001
    );
    if (match) {
      return match;
    }
  }
  return (
    formats.find((format) => format.pixel_format === "MJPG" && format.width <= 1920 && format.height <= 1080) ??
    formats[0] ??
    null
  );
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
      const defaultFormat = defaultPreviewFormat(loaded);
      setFormats(loaded);
      setSelectedKeyState((current) =>
        current && loaded.some((format) => formatKey(format) === current)
          ? current
          : defaultFormat
            ? formatKey(defaultFormat)
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
      const previousKey = selectedKey;
      setSelectedKeyState(key);
      setPending(true);
      setError(null);
      try {
        const accepted = await setVideoFormat(deviceName, selected);
        const acceptedMatch = formats.find((format) => formatsMatch(format, accepted));
        setSelectedKeyState(acceptedMatch ? formatKey(acceptedMatch) : key);
      } catch (err) {
        setSelectedKeyState(previousKey);
        setError(err instanceof Error ? err.message : "Unable to set video format");
      } finally {
        setPending(false);
      }
    },
    [deviceName, formats, selectedKey]
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

function formatsMatch(left: VideoFormatOption, right: VideoFormatOption): boolean {
  if (left.pixel_format !== right.pixel_format || left.width !== right.width || left.height !== right.height) {
    return false;
  }
  if (left.frame_interval_100ns != null && right.frame_interval_100ns != null) {
    return Math.abs(left.frame_interval_100ns - right.frame_interval_100ns) <= 1;
  }
  return Math.abs(left.fps - right.fps) < 0.001;
}
