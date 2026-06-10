import { Eye, EyeOff, RadioTower, Square, Video } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import { focusPointFromContainClick, type FocusPoint } from "../../domains/video/focusPoint";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UseVideoCaptureResult } from "../../hooks/useVideoCapture";
import type { UseVideoFormatsResult } from "../../hooks/useVideoFormats";

type Props = {
  deviceName: string | null;
  videoFormats: UseVideoFormatsResult;
  videoCapture: UseVideoCaptureResult;
  pixyHid: UsePixyHidResult;
};

export function VideoMonitor({ deviceName, videoFormats, videoCapture, pixyHid }: Props) {
  const selectedFormat = videoFormats.selectedFormat;
  const canUseVideo = Boolean(deviceName && selectedFormat);
  const isRecording = videoCapture.status?.recording === true;
  const [focusTarget, setFocusTarget] = useState<FocusPoint | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const canClickFocus =
    Boolean(videoCapture.streamUrl && selectedFormat) &&
    pixyHid.status?.writable === true &&
    pixyHid.status.known_controls.includes("focus_metering") &&
    pixyHid.pendingCommand === null;

  const handleFocusClick = async (event: PointerEvent<HTMLDivElement>) => {
    if (!canClickFocus || !selectedFormat) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const point = focusPointFromContainClick(
      { width: rect.width, height: rect.height },
      { width: selectedFormat.width, height: selectedFormat.height },
      { x: event.clientX - rect.left, y: event.clientY - rect.top }
    );
    if (!point) {
      return;
    }

    await pixyHid.setFocusMeteringMode("selected_area", point);
    setFocusTarget({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    });
  };

  useEffect(
    () => () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    },
    []
  );

  const handleStreamError = () => {
    if (!videoCapture.previewEnabled || reconnectTimerRef.current !== null) {
      return;
    }
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      videoCapture.restartPreview();
    }, 750);
  };

  const handleStreamLoad = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  return (
    <section className="video-monitor control-panel accent-cyan">
      <div className="video-monitor-header">
        <div className="panel-title-row">
          <Video size={18} />
          <h2>Live Monitor</h2>
        </div>
        <div className="video-actions">
          <button
            className="secondary-button"
            disabled={!canUseVideo}
            onClick={videoCapture.togglePreview}
            aria-label={videoCapture.previewEnabled ? "Hide stream" : "Show stream"}
            title={videoCapture.previewEnabled ? "Hide stream" : "Show stream"}
          >
            {videoCapture.previewEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
            {videoCapture.previewEnabled ? "Hide" : "Show"}
          </button>
          <button
            className={`secondary-button record-button ${isRecording ? "is-recording" : ""}`}
            disabled={!canUseVideo || videoCapture.pending}
            onClick={() => void (isRecording ? videoCapture.stopRecording() : videoCapture.startRecording())}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <Square size={15} /> : <RadioTower size={16} />}
            {isRecording ? "Stop" : "Record"}
          </button>
        </div>
      </div>

      <div
        className={`video-frame ${canClickFocus ? "can-click-focus" : ""}`}
        onPointerUp={(event) => void handleFocusClick(event)}
        title={canClickFocus ? "Click to set focus target" : undefined}
      >
        {videoCapture.streamUrl ? (
          <>
            <img
              key={videoCapture.streamUrl}
              src={videoCapture.streamUrl}
              alt="Live camera stream"
              onError={handleStreamError}
              onLoad={handleStreamLoad}
            />
            {focusTarget && (
              <span
                className="focus-target-reticle"
                style={{ left: `${focusTarget.x}%`, top: `${focusTarget.y}%` }}
                aria-hidden="true"
              />
            )}
          </>
        ) : (
          <div className="video-placeholder">
            <Video size={28} />
            <strong>{canUseVideo ? "Preview paused" : "No capture device"}</strong>
            <span>{selectedFormat?.label ?? "Select a capture format"}</span>
          </div>
        )}
      </div>

      <div className="video-status-row">
        <span>{selectedFormat?.label ?? "No stream format selected"}</span>
        <strong>{isRecording ? "Recording" : videoCapture.previewEnabled ? "Previewing" : "Idle"}</strong>
      </div>
      {videoCapture.status?.path && <div className="video-record-path">{videoCapture.status.path}</div>}
      {videoCapture.error && <div className="mini-error">{videoCapture.error}</div>}
    </section>
  );
}
