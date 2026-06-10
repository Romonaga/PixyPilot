import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchVideoRecordingStatus,
  startVideoRecording,
  stopVideoStream,
  stopVideoRecording,
  videoStreamUrl
} from "../lib/apiClient";
import type { VideoFormatOption, VideoRecordingStatus } from "../types/api";

export type UseVideoCaptureResult = {
  previewEnabled: boolean;
  streamUrl: string | null;
  status: VideoRecordingStatus | null;
  pending: boolean;
  error: string | null;
  togglePreview: () => void;
  restartPreview: () => void;
  refreshStatus: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
};

export function useVideoCapture(
  deviceName: string | null,
  selectedFormat: VideoFormatOption | null
): UseVideoCaptureResult {
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [streamToken, setStreamToken] = useState(0);
  const [status, setStatus] = useState<VideoRecordingStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousDeviceNameRef = useRef<string | null>(deviceName);

  const streamUrl = useMemo(() => {
    if (!previewEnabled || !deviceName || !selectedFormat) {
      return null;
    }
    return videoStreamUrl(deviceName, selectedFormat, streamToken);
  }, [deviceName, previewEnabled, selectedFormat, streamToken]);

  const refreshStatus = useCallback(async () => {
    setError(null);
    try {
      setStatus(await fetchVideoRecordingStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to inspect recording state");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const previousDeviceName = previousDeviceNameRef.current;
    setPreviewEnabled((enabled) => {
      if (enabled && previousDeviceName) {
        void stopVideoStream(previousDeviceName).catch(() => undefined);
      }
      return false;
    });
    setStreamToken((current) => current + 1);
    previousDeviceNameRef.current = deviceName;
  }, [deviceName]);

  useEffect(() => {
    setStreamToken((current) => current + 1);
  }, [selectedFormat]);

  const togglePreview = useCallback(() => {
    setPreviewEnabled((enabled) => {
      if (!enabled) {
        setStreamToken((current) => current + 1);
        setError(null);
      } else if (deviceName) {
        void stopVideoStream(deviceName).catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to release preview stream");
        });
      }
      return !enabled;
    });
  }, [deviceName]);

  const restartPreview = useCallback(() => {
    setStreamToken((current) => current + 1);
  }, []);

  const startRecording = useCallback(async () => {
    if (!deviceName || !selectedFormat) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      setStatus(await startVideoRecording(deviceName, selectedFormat));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start recording");
    } finally {
      setPending(false);
    }
  }, [deviceName, selectedFormat]);

  const stopRecording = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setStatus(await stopVideoRecording());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to stop recording");
    } finally {
      setPending(false);
    }
  }, []);

  return {
    previewEnabled,
    streamUrl,
    status,
    pending,
    error,
    togglePreview,
    restartPreview,
    refreshStatus,
    startRecording,
    stopRecording
  };
}
