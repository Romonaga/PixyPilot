import { ServerCog } from "lucide-react";
import { useState } from "react";

import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import { EditableRuntimeRow, ReadOnlyRuntimeRow } from "./RuntimeSettingRow";
import { runtimeSettings, type RuntimeSetting } from "./runtimeSettings";

type Props = {
  privacySafety: UsePrivacySafetyResult;
};

export function RuntimeSettingsPanel({ privacySafety }: Props) {
  const settings = privacySafety.settings;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const rows = settings ? runtimeSettings(settings) : [];
  const pending = privacySafety.settingsPending;

  const startEdit = (row: RuntimeSetting) => {
    setEditingId(row.id);
    setDraft(row.value);
    setMessage(null);
  };

  const saveRow = async (row: RuntimeSetting) => {
    await privacySafety.saveSettings(row.apply(draft));
    setEditingId(null);
    setMessage(`${row.label} saved`);
  };

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
      {privacySafety.settingsError && <div className="mini-error">{privacySafety.settingsError}</div>}
      {message && <div className="mini-success">{message}</div>}
      <div className="runtime-list">
        <ReadOnlyRuntimeRow label="YAML" value={settings?.config.path ?? "config/pixypilot.yaml"} />
        {rows.map((row) => (
          <EditableRuntimeRow
            key={row.id}
            row={row}
            disabled={pending}
            editing={editingId === row.id}
            draft={draft}
            onCancel={() => setEditingId(null)}
            onDraftChange={setDraft}
            onEdit={() => startEdit(row)}
            onSave={() => void saveRow(row)}
          />
        ))}
      </div>
    </section>
  );
}
