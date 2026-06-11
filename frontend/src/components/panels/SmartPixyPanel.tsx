import { useEffect, useState } from "react";
import { ScanFace, Shield, Sparkles, Volume2 } from "lucide-react";

import type { UseAudioResult } from "../../hooks/useAudio";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { AudioMode, TargetTrackingMode, TrackingMode } from "../../types/api";

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
  const privacyEnabled = pixyHid.deviceTrackingState === "privacy" || pixyHid.trackingMode === "privacy";
  const targetTrackingReady = pixyHid.status?.known_controls.includes("target_tracking") ?? false;
  const deviceTrackingText = deviceTrackingStateText(
    pixyHid.deviceTrackingState,
    pixyHid.deviceTrackingRawValue,
    pixyHid.deviceTrackingRawBits
  );
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

  const setControlMode = (mode: TrackingMode) => {
    if (mode === "privacy") {
      void privacySafety.enterPrivacy();
      return;
    }
    if (mode === "off") {
      if (targetTrackingReady) {
        void pixyHid.setTargetTrackingMode("off");
      } else {
        void privacySafety.leavePrivacy();
      }
      return;
    }
    if (targetTrackingReady) {
      void pixyHid.setTargetTrackingMode("face");
      return;
    }
    void pixyHid.setTrackingMode(mode);
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
      <div className={`privacy-safety-strip state-${privacySafety.startupPrivacyState}`}>
        <Shield size={15} />
        <span>{privacySafetyText(privacySafety)}</span>
      </div>

      <div className="smart-control-stack">
        <div className="smart-control privacy-control">
          <div className="smart-label">
            <Shield size={16} />
            <span>Control Mode</span>
          </div>
          <div className="privacy-control-body">
            <div className={`device-mode-readback state-${pixyHid.deviceTrackingState}`}>
              <span>Device reports</span>
              <strong>{deviceTrackingText}</strong>
            </div>
            <div className="privacy-mode-row">
              <span>Mode</span>
              <div className="segmented control-mode-command">
                {controlModes.map((mode) => (
                  <button
                    key={mode.value}
                    className={pixyHid.trackingMode === mode.value ? "is-selected" : ""}
                    disabled={disabled}
                    onClick={() => setControlMode(mode.value)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="privacy-mode-row">
              <span>Timer</span>
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
            <small className="privacy-help">
              {privacyEnabled
                ? "Device readback or last command indicates privacy. Auto entry is only used after privacy is off."
                : pixyHid.targetTrackingMode && pixyHid.targetTrackingMode !== "off"
                  ? `Target tracking: ${targetTrackingLabel(pixyHid.targetTrackingMode)}. It visibly follows while a video stream is open.`
                  : pixyHid.deviceTrackingState === "non_privacy"
                    ? "Device confirms non-privacy. Standard vs Tracking is shown from the last command until a better readback is found."
                    : "Device mode is unknown after refresh. Select Privacy to send privacy mode now."}
            </small>
            {targetTrackingReady && (
              <div className="privacy-mode-row">
                <span>Target</span>
                <div className="segmented target-tracking-command">
                  {targetTrackingModes.map((mode) => (
                    <button
                      key={mode.value}
                      className={pixyHid.targetTrackingMode === mode.value ? "is-selected" : ""}
                      disabled={disabled || privacyEnabled}
                      onClick={() => void pixyHid.setTargetTrackingMode(mode.value)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
      </div>

      {pixyHid.lastCommand && <div className="last-command">Last command: {pixyHid.lastCommand}</div>}
    </section>
  );
}

const controlModes: { value: TrackingMode; label: string }[] = [
  { value: "off", label: "Standard" },
  { value: "tracking", label: "Tracking" },
  { value: "privacy", label: "Privacy" }
];

const targetTrackingModes: { value: TargetTrackingMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "face", label: "Face" },
  { value: "half_body", label: "Half" },
  { value: "full_body", label: "Full" }
];

function targetTrackingLabel(mode: TargetTrackingMode) {
  return targetTrackingModes.find((option) => option.value === mode)?.label ?? mode;
}

function privacySafetyText(privacySafety: UsePrivacySafetyResult) {
  if (!privacySafety.startupPrivacyEnabled) {
    return "Startup privacy disabled";
  }
  if (privacySafety.startupPrivacyState === "waiting-for-hid") {
    return "Startup privacy armed; waiting for HID access";
  }
  if (privacySafety.startupPrivacyState === "sending") {
    return "Startup privacy sending";
  }
  if (privacySafety.startupPrivacyState === "sent") {
    return "Startup privacy sent; mic mute requested";
  }
  if (privacySafety.startupPrivacyState === "failed") {
    return "Startup privacy failed; press Privacy to retry";
  }
  return "Loading startup privacy setting";
}

function deviceTrackingStateText(state: UsePixyHidResult["deviceTrackingState"], rawValue: number | null, rawBits: number[]) {
  const raw = rawValue === null ? "" : ` raw ${rawValue}${rawBits.length ? ` bits ${rawBits.join(",")}` : ""}`;
  if (state === "privacy") {
    return `Privacy${raw}`;
  }
  if (state === "non_privacy") {
    return `Non-privacy${raw}`;
  }
  return raw ? `Unknown${raw}` : "Unknown";
}
