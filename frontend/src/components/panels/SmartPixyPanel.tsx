import { Radio, Shield, Sparkles, Volume2 } from "lucide-react";

import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { AudioMode, TrackingMode } from "../../types/api";

type Props = {
  pixyHid: UsePixyHidResult;
};

const trackingModes: { value: TrackingMode; label: string }[] = [
  { value: "off", label: "Idle" },
  { value: "tracking", label: "Track" },
  { value: "privacy", label: "Privacy" }
];

const audioModes: { value: AudioMode; label: string }[] = [
  { value: "noise_cancel", label: "NC" },
  { value: "live", label: "Live" },
  { value: "original", label: "Original" }
];

export function SmartPixyPanel({ pixyHid }: Props) {
  const writable = pixyHid.status?.writable ?? false;
  const available = pixyHid.status?.available ?? false;
  const disabled = !writable || pixyHid.pendingCommand !== null;

  return (
    <section className="smart-panel">
      <div className="panel-title-row">
        <Sparkles size={18} />
        <h2>Smart Pixy</h2>
      </div>

      <div className="hid-status-row">
        <span className={`hid-dot ${writable ? "is-ready" : available ? "is-warn" : ""}`} />
        <div>
          <strong>{writable ? "HID ready" : available ? "HID permission needed" : "HID not found"}</strong>
          <small>{pixyHid.status?.path ?? pixyHid.status?.reason ?? "Scanning hidraw devices"}</small>
        </div>
      </div>

      {pixyHid.error && <div className="mini-error">{pixyHid.error}</div>}
      {!writable && pixyHid.status?.reason && <div className="mini-warning">{pixyHid.status.reason}</div>}

      <div className="smart-control-stack">
        <div className="smart-control">
          <div className="smart-label">
            <Radio size={16} />
            <span>Tracking</span>
          </div>
          <div className="segmented">
            {trackingModes.map((mode) => (
              <button
                key={mode.value}
                className={pixyHid.trackingMode === mode.value ? "is-selected" : ""}
                disabled={disabled}
                onClick={() => void pixyHid.setTrackingMode(mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="smart-control">
          <div className="smart-label">
            <Shield size={16} />
            <span>Gesture</span>
          </div>
          <button
            className={`toggle-switch ${pixyHid.gestureEnabled ? "is-on" : ""}`}
            disabled={disabled}
            aria-pressed={pixyHid.gestureEnabled === true}
            onClick={() => void pixyHid.setGestureEnabled(!(pixyHid.gestureEnabled ?? false))}
          >
            <span />
          </button>
        </div>

        <div className="smart-control">
          <div className="smart-label">
            <Volume2 size={16} />
            <span>Audio</span>
          </div>
          <div className="segmented">
            {audioModes.map((mode) => (
              <button
                key={mode.value}
                className={pixyHid.audioMode === mode.value ? "is-selected" : ""}
                disabled={disabled}
                onClick={() => void pixyHid.setAudioMode(mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <label className="smart-control smart-control-privacy">
          <div className="smart-label">
            <Shield size={16} />
            <span>Auto privacy</span>
          </div>
          <input
            className="number-input"
            type="number"
            min={0}
            max={255}
            step={1}
            disabled={disabled}
            value={pixyHid.autoPrivacySeconds ?? 0}
            onChange={(event) => void pixyHid.setAutoPrivacySeconds(Number(event.target.value))}
          />
        </label>
      </div>

      {pixyHid.lastCommand && <div className="last-command">Last command: {pixyHid.lastCommand}</div>}
    </section>
  );
}
