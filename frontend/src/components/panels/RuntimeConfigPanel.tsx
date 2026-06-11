import { Check, FileCog, Pencil, ServerCog, X } from "lucide-react";
import { useState } from "react";

import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { AppSettingsUpdate } from "../../types/api";

type Props = {
  privacySafety: UsePrivacySafetyResult;
};

type RuntimeSetting = {
  id: string;
  label: string;
  value: string;
  detail: string;
  apply: (value: string) => AppSettingsUpdate;
  inputMode?: "text" | "number" | "select";
  options?: { label: string; value: string }[];
};

export function RuntimeConfigPanel({ privacySafety }: Props) {
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

function ReadOnlyRuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="runtime-row">
      <FileCog size={14} />
      <span>{label}</span>
      <code title={value}>{value}</code>
      <span className="runtime-badge">read</span>
    </div>
  );
}

function EditableRuntimeRow({
  row,
  disabled,
  editing,
  draft,
  onCancel,
  onDraftChange,
  onEdit,
  onSave
}: {
  row: RuntimeSetting;
  disabled: boolean;
  editing: boolean;
  draft: string;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
}) {
  return (
    <div className={`runtime-row ${editing ? "is-editing" : ""}`}>
      <FileCog size={14} />
      <span>{row.label}</span>
      {editing ? (
        row.inputMode === "select" ? (
          <select className="runtime-input" disabled={disabled} value={draft} onChange={(event) => onDraftChange(event.target.value)}>
            {row.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="runtime-input"
            disabled={disabled}
            inputMode={row.inputMode === "number" ? "numeric" : "text"}
            type={row.inputMode === "number" ? "number" : "text"}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSave();
              }
              if (event.key === "Escape") {
                onCancel();
              }
            }}
          />
        )
      ) : (
        <code title={row.value}>{displayValue(row)}</code>
      )}
      {editing ? (
        <div className="runtime-actions">
          <button className="icon-button" disabled={disabled || !draftIsValid(row, draft)} aria-label={`Save ${row.label}`} onClick={onSave}>
            <Check size={15} />
          </button>
          <button className="icon-button" disabled={disabled} aria-label={`Cancel ${row.label}`} onClick={onCancel}>
            <X size={15} />
          </button>
        </div>
      ) : (
        <button className="icon-button runtime-edit-button" disabled={disabled} aria-label={`Edit ${row.label}`} onClick={onEdit}>
          <Pencil size={14} />
        </button>
      )}
      <small className={`runtime-badge ${row.detail === "live" ? "is-live" : ""}`}>{row.detail}</small>
    </div>
  );
}

function runtimeSettings(settings: NonNullable<UsePrivacySafetyResult["settings"]>): RuntimeSetting[] {
  return [
    {
      id: "startup-privacy",
      label: "Startup",
      value: String(settings.safety.start_in_privacy),
      detail: "live",
      inputMode: "select",
      options: [
        { label: "Start private", value: "true" },
        { label: "Do not auto-park", value: "false" }
      ],
      apply: (value) => ({ safety: { start_in_privacy: value === "true" } })
    },
    {
      id: "server-host",
      label: "Bind host",
      value: settings.server.host,
      detail: "restart",
      apply: (value) => ({ server: { host: cleanText(value, settings.server.host) } })
    },
    {
      id: "server-port",
      label: "Bind port",
      value: String(settings.server.port),
      detail: "restart",
      inputMode: "number",
      apply: (value) => ({ server: { port: toPort(value, settings.server.port) } })
    },
    {
      id: "vite-host",
      label: "Vite host",
      value: settings.frontend.dev_server_host,
      detail: "dev restart",
      apply: (value) => ({ frontend: { dev_server: { host: cleanText(value, settings.frontend.dev_server_host) } } })
    },
    {
      id: "vite-port",
      label: "Vite port",
      value: String(settings.frontend.dev_server_port),
      detail: "dev restart",
      inputMode: "number",
      apply: (value) => ({ frontend: { dev_server: { port: toPort(value, settings.frontend.dev_server_port) } } })
    },
    {
      id: "frontend-dist",
      label: "UI dist",
      value: settings.frontend.dist_path,
      detail: "restart",
      apply: (value) => ({ frontend: { dist: cleanText(value, settings.frontend.dist_path) } })
    },
    {
      id: "presets",
      label: "Presets",
      value: settings.storage.presets_path,
      detail: "live",
      apply: (value) => ({ storage: { presets: cleanText(value, settings.storage.presets_path) } })
    },
    {
      id: "recordings",
      label: "Recordings",
      value: settings.storage.recordings_dir,
      detail: "live",
      apply: (value) => ({ storage: { recordings: cleanText(value, settings.storage.recordings_dir) } })
    },
    {
      id: "hid-path",
      label: "HID path",
      value: settings.hid.path ?? "",
      detail: "live",
      apply: (value) => ({ hid: { path: value.trim() || null } })
    },
    {
      id: "hid-gap",
      label: "HID gap",
      value: String(settings.hid.report_gap_ms),
      detail: "live",
      inputMode: "number",
      apply: (value) => ({ hid: { report_gap_ms: toBoundedInt(value, settings.hid.report_gap_ms, 0, 1000) } })
    }
  ];
}

function displayValue(row: RuntimeSetting) {
  if (row.inputMode !== "select") {
    return row.value || "auto";
  }
  return row.options?.find((option) => option.value === row.value)?.label ?? row.value;
}

function draftIsValid(row: RuntimeSetting, draft: string) {
  if (row.inputMode === "number") {
    const parsed = Number(draft);
    const max = row.id === "hid-gap" ? 1000 : 65535;
    const min = row.id === "hid-gap" ? 0 : 1;
    return Number.isInteger(parsed) && parsed >= min && parsed <= max;
  }
  if (row.id !== "hid-path" && row.inputMode !== "select") {
    return draft.trim().length > 0;
  }
  return true;
}

function cleanText(value: string, fallback: string) {
  return value.trim() || fallback;
}

function toPort(value: string, fallback: number) {
  return toBoundedInt(value, fallback, 1, 65535);
}

function toBoundedInt(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}
