import { TerminalSquare } from "lucide-react";

import type { UseAudioResult } from "../../hooks/useAudio";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { UseVideoCaptureResult } from "../../hooks/useVideoCapture";
import type { UseVideoFormatsResult } from "../../hooks/useVideoFormats";

type Props = {
  controls: UseControlsResult;
  videoFormats: UseVideoFormatsResult;
  videoCapture: UseVideoCaptureResult;
  pixyHid: UsePixyHidResult;
  audio: UseAudioResult;
  privacySafety: UsePrivacySafetyResult;
};

export function CommandLogPanel({ controls, videoFormats, videoCapture, pixyHid, audio, privacySafety }: Props) {
  const rows = [
    {
      label: "HID",
      value: pixyHid.pendingCommand ? `pending ${pixyHid.pendingCommand}` : pixyHid.lastCommand ?? "idle"
    },
    {
      label: "V4L2",
      value: controls.pendingControl ? `writing ${controls.pendingControl}` : `${controls.controls.length} controls ready`
    },
    {
      label: "Focus",
      value: pixyHid.focusMeteringPoint
        ? `${pixyHid.focusMeteringMode ?? "selected"} @ ${pixyHid.focusMeteringPoint.x},${pixyHid.focusMeteringPoint.y}`
        : pixyHid.focusMeteringMode ?? "no target"
    },
    {
      label: "Stream",
      value: videoFormats.pending
        ? "format switching"
        : videoCapture.previewEnabled
          ? videoFormats.selectedFormat?.label ?? "preview active"
          : videoFormats.selectedFormat?.label ?? "idle"
    },
    {
      label: "Record",
      value: videoCapture.status?.recording ? "recording" : "standby"
    },
    {
      label: "Audio",
      value: audio.pending ? "mute pending" : audio.status?.muted ? "mic muted" : "mic live"
    },
    {
      label: "Safety",
      value: privacyStatusText(privacySafety)
    }
  ];

  return (
    <section className="command-log-panel">
      <div className="panel-title-row">
        <TerminalSquare size={18} />
        <h2>Command Log</h2>
      </div>
      <div className="command-log-list">
        {rows.map((row) => (
          <div className="command-log-row" key={row.label}>
            <span>{row.label}</span>
            <code>{row.value}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function privacyStatusText(privacySafety: UsePrivacySafetyResult) {
  if (!privacySafety.startupPrivacyEnabled) {
    return "startup privacy disabled";
  }
  if (privacySafety.startupPrivacyState === "waiting-for-hid") {
    return "waiting for HID";
  }
  if (privacySafety.startupPrivacyState === "sending") {
    return "startup privacy sending";
  }
  if (privacySafety.startupPrivacyState === "sent") {
    return "startup privacy sent";
  }
  if (privacySafety.startupPrivacyState === "failed") {
    return "startup privacy failed";
  }
  return "loading safety";
}
