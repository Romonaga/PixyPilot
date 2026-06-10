import { Eye, EyeOff, RadioTower, Square, Video } from "lucide-react";

import type { UseVideoCaptureResult } from "../../hooks/useVideoCapture";
import type { UseVideoFormatsResult } from "../../hooks/useVideoFormats";

type Props = {
  deviceName: string | null;
  videoFormats: UseVideoFormatsResult;
  videoCapture: UseVideoCaptureResult;
};

export function VideoMonitor({ deviceName, videoFormats, videoCapture }: Props) {
  const selectedFormat = videoFormats.selectedFormat;
  const canUseVideo = Boolean(deviceName && selectedFormat);
  const isRecording = videoCapture.status?.recording === true;

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

      <div className="video-frame">
        {videoCapture.streamUrl ? (
          <img src={videoCapture.streamUrl} alt="Live camera stream" />
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
