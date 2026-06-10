import { FileCog, ServerCog } from "lucide-react";

import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";

type Props = {
  privacySafety: UsePrivacySafetyResult;
};

export function RuntimeConfigPanel({ privacySafety }: Props) {
  const settings = privacySafety.settings;

  return (
    <section className="runtime-panel">
      <div className="panel-title-row">
        <ServerCog size={18} />
        <h2>Runtime Config</h2>
      </div>
      <div className="runtime-mode">
        <strong>{settings?.server.url ?? "http://127.0.0.1:8000"}</strong>
        <span>{settings?.frontend.single_port ? "Single address" : "Developer mode"}</span>
      </div>
      <div className="runtime-list">
        <RuntimeRow label="YAML" value={settings?.config.path ?? "config/pixypilot.yaml"} />
        <RuntimeRow label="Presets" value={settings?.storage.presets_path ?? "config/presets.yaml"} />
        <RuntimeRow label="Recordings" value={settings?.storage.recordings_dir ?? "recordings"} />
        <RuntimeRow
          label="Vite"
          value={
            settings
              ? `${settings.frontend.dev_server_host}:${settings.frontend.dev_server_port} dev only`
              : "127.0.0.1:5173 dev only"
          }
        />
      </div>
    </section>
  );
}

function RuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="runtime-row">
      <FileCog size={14} />
      <span>{label}</span>
      <code title={value}>{value}</code>
    </div>
  );
}
