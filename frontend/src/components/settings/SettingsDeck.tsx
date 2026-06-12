import { FileCog, ShieldCheck } from "lucide-react";

import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import { RuntimeSettingsPanel } from "./RuntimeSettingsPanel";

type Props = {
  privacySafety: UsePrivacySafetyResult;
};

export function SettingsDeck({ privacySafety }: Props) {
  const settings = privacySafety.settings;

  return (
    <div className="settings-console">
      <section className="settings-summary-panel">
        <div className="panel-title-row">
          <FileCog size={18} />
          <h2>Settings</h2>
        </div>
        <div className="settings-summary-grid">
          <SettingsSummaryItem
            label="Startup"
            value={settings?.safety.start_in_privacy ? "Start private" : "No auto privacy"}
            tone={settings?.safety.start_in_privacy ? "good" : "warn"}
          />
          <SettingsSummaryItem
            label="Server"
            value={settings?.server.url ?? "http://127.0.0.1:8000"}
            tone={settings?.frontend.single_port ? "good" : "warn"}
          />
          <SettingsSummaryItem
            label="Mode"
            value={settings?.frontend.single_port ? "Single address" : "Developer mode"}
            tone={settings?.frontend.single_port ? "good" : "warn"}
          />
          <SettingsSummaryItem
            label="HID"
            value={settings?.hid.path ?? "Auto detect"}
            tone="info"
          />
        </div>
      </section>
      <RuntimeSettingsPanel privacySafety={privacySafety} />
    </div>
  );
}

function SettingsSummaryItem({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "info" }) {
  return (
    <div className={`settings-summary-item tone-${tone}`}>
      <ShieldCheck size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
