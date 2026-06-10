import { useEffect, useState } from "react";
import { ScanFace, Shield, Sparkles, Volume2 } from "lucide-react";

import type { UseAudioResult } from "../../hooks/useAudio";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { AudioMode, TrackingMode } from "../../types/api";

type Props = {
  pixyHid: UsePixyHidResult;
  audio: UseAudioResult;
  privacySafety: UsePrivacySafetyResult;
};

const audioModes: { value: AudioMode; label: string }[] = [
  { value: "noise_cancel", label: "NC" },
  { value: "live", label: "Live" },
  { value: "original", label: "Original" }
];

const autoPrivacyPresets = [
  { value: 0, label: "Never" },
  { value: 10, label: "10s" },
  { value: 60, label: "1m" },
  { value: 900, label: "15m" }
];

export function SmartPixyPanel({ pixyHid, audio, privacySafety }: Props) {
  const writable = pixyHid.status?.writable ?? false;
  const available = pixyHid.status?.available ?? false;
  const disabled = !writable || pixyHid.pendingCommand !== null;
  const micMuted = audio.status?.muted === true;
  const micAvailable = audio.status?.available === true;
  const autoFollowEnabled = pixyHid.trackingMode === "tracking";
  const privacyEnabled = pixyHid.trackingMode === "privacy";
  const autoFollowDisabled = disabled || privacyEnabled;
  const [autoPrivacyDraft, setAutoPrivacyDraft] = useState(String(pixyHid.autoPrivacySeconds ?? 0));

  useEffect(() => {
    setAutoPrivacyDraft(String(pixyHid.autoPrivacySeconds ?? 0));
  }, [pixyHid.autoPrivacySeconds]);

  const commitAutoPrivacy = () => {
    const parsed = Number(autoPrivacyDraft);
    const clamped = Number.isFinite(parsed) ? Math.min(900, Math.max(0, Math.trunc(parsed))) : 0;
    setAutoPrivacyDraft(String(clamped));
    if (pixyHid.autoPrivacySeconds !== clamped) {
      void pixyHid.setAutoPrivacySeconds(clamped);
    }
  };

  const setAutoPrivacyPreset = (seconds: number) => {
    setAutoPrivacyDraft(String(seconds));
    if (pixyHid.autoPrivacySeconds !== seconds) {
      void pixyHid.setAutoPrivacySeconds(seconds);
    }
  };

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
        <div className="smart-control smart-toggle-row">
          <div className="smart-label">
            <ScanFace size={16} />
            <span>Auto Follow</span>
          </div>
          <button
            className={`toggle-switch ${autoFollowEnabled ? "is-on" : ""}`}
            disabled={autoFollowDisabled}
            aria-pressed={autoFollowEnabled}
            aria-label="Auto Follow"
            title={privacyEnabled ? "Turn privacy off before enabling auto follow" : "Auto Follow"}
            onClick={() => void pixyHid.setTrackingMode(autoFollowEnabled ? "off" : "tracking")}
          >
            <span />
          </button>
        </div>

        <div className="smart-control">
          <div className="smart-label">
            <Shield size={16} />
            <span>Privacy Mode</span>
          </div>
          <div className="segmented privacy-command">
            <button
              className={pixyHid.trackingMode === "off" ? "is-selected" : ""}
              disabled={disabled}
              onClick={() => void privacySafety.leavePrivacy()}
            >
              Off
            </button>
            <button
              className={privacyEnabled ? "is-selected" : ""}
              disabled={disabled}
              onClick={() => void privacySafety.enterPrivacy()}
            >
              Privacy
            </button>
          </div>
        </div>

        <div className="smart-control smart-toggle-row">
          <div className="smart-label">
            <Shield size={16} />
            <span>Gesture Control</span>
          </div>
          <button
            className={`toggle-switch ${pixyHid.gestureEnabled ? "is-on" : ""}`}
            disabled={disabled}
            aria-pressed={pixyHid.gestureEnabled === true}
            aria-label="Gesture Control"
            onClick={() => void pixyHid.setGestureEnabled(!(pixyHid.gestureEnabled ?? false))}
          >
            <span />
          </button>
        </div>

        <div className="smart-control smart-toggle-row">
          <div className="smart-label">
            <ScanFace size={16} />
            <span>Auto Rotate</span>
          </div>
          <button
            className={`toggle-switch ${pixyHid.autoRotateEnabled ? "is-on" : ""}`}
            disabled={disabled}
            aria-pressed={pixyHid.autoRotateEnabled === true}
            aria-label="Auto Rotate"
            onClick={() => void pixyHid.setAutoRotateEnabled(!(pixyHid.autoRotateEnabled ?? false))}
          >
            <span />
          </button>
        </div>

        <div className="smart-control">
          <div className="smart-label">
            <Volume2 size={16} />
            <span>Audio</span>
          </div>
          <div className="mic-mute-row">
            <div>
              <strong>Mic mute</strong>
              <small>
                {micAvailable
                  ? `ALSA card ${audio.status?.card}${audio.status?.volume !== null ? `, gain ${audio.status?.volume}` : ""}`
                  : audio.status?.reason ?? "Scanning USB audio"}
              </small>
            </div>
            <button
              className={`toggle-switch ${micMuted ? "is-on" : ""}`}
              disabled={!micAvailable || audio.pending}
              aria-pressed={micMuted}
              aria-label="Mic mute"
              onClick={() => void audio.setMuted(!micMuted)}
            >
              <span />
            </button>
          </div>
          {audio.error && <div className="mini-error">{audio.error}</div>}
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

        <div className="smart-control smart-control-privacy">
          <div className="smart-label">
            <Shield size={16} />
            <span>Auto privacy delay</span>
          </div>
          <div className="segmented">
            {autoPrivacyPresets.map((preset) => (
              <button
                key={preset.value}
                className={pixyHid.autoPrivacySeconds === preset.value ? "is-selected" : ""}
                disabled={disabled}
                onClick={() => setAutoPrivacyPreset(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="privacy-delay-input">
            <input
              className="number-input"
              type="number"
              min={0}
              max={900}
              step={1}
              disabled={disabled}
              value={autoPrivacyDraft}
              onChange={(event) => setAutoPrivacyDraft(event.target.value)}
              onBlur={commitAutoPrivacy}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitAutoPrivacy();
                }
              }}
            />
            <span>sec</span>
          </div>
        </div>
      </div>

      {pixyHid.lastCommand && <div className="last-command">Last command: {pixyHid.lastCommand}</div>}
    </section>
  );
}
