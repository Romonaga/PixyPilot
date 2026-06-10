import { RefreshCw, Radar, RadioTower } from "lucide-react";

import { countActiveControls } from "../../domains/controls/grouping";
import type { UseAudioResult } from "../../hooks/useAudio";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UseDevicesResult } from "../../hooks/useDevices";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { UseVideoFormatsResult } from "../../hooks/useVideoFormats";
import { ControlGroupPanel } from "../controls/ControlGroupPanel";
import { DeviceRail } from "../panels/DeviceRail";
import { ExperimentalPanel } from "../panels/ExperimentalPanel";
import { SmartPixyPanel } from "../panels/SmartPixyPanel";
import { StatusPill } from "../ui/StatusPill";

type Props = {
  devices: UseDevicesResult;
  controls: UseControlsResult;
  videoFormats: UseVideoFormatsResult;
  pixyHid: UsePixyHidResult;
  audio: UseAudioResult;
  privacySafety: UsePrivacySafetyResult;
};

export function AppShell({ devices, controls, videoFormats, pixyHid, audio, privacySafety }: Props) {
  const activeControls = countActiveControls(controls.controls);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Radar size={24} />
          </div>
          <div>
            <h1>PixyPilot</h1>
            <p>Linux control deck for EMEET PIXY</p>
          </div>
        </div>
        <div className="topbar-actions">
          <StatusPill
            tone={devices.selectedDevice ? "good" : "warn"}
            label={devices.selectedDevice ? "Device linked" : "No device"}
          />
          <StatusPill tone="info" label={`${activeControls}/${controls.controls.length} active`} />
          <button className="icon-button" onClick={() => void controls.refresh()} title="Refresh controls">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <section className="command-grid">
        <DeviceRail devices={devices} controls={controls} videoFormats={videoFormats} pixyHid={pixyHid} />

        <div className="main-console">
          {controls.error && <div className="error-strip">{controls.error}</div>}
          {devices.error && <div className="error-strip">{devices.error}</div>}
          <div className="control-grid">
            {controls.groups.map((group) => (
              <ControlGroupPanel key={group.id} group={group} controls={controls} pixyHid={pixyHid} />
            ))}
          </div>
        </div>

        <aside className="right-console">
          <div className="signal-panel">
            <div className="panel-title-row">
              <RadioTower size={18} />
              <h2>Signal</h2>
            </div>
            <div className="telemetry-stack">
              <span>V4L2 online</span>
              <strong>{controls.isLoading ? "Scanning" : "Ready"}</strong>
            </div>
          </div>
          <SmartPixyPanel pixyHid={pixyHid} audio={audio} privacySafety={privacySafety} />
          <ExperimentalPanel />
        </aside>
      </section>
    </main>
  );
}
