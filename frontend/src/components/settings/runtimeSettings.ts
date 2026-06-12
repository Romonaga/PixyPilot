import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { AppSettingsUpdate } from "../../types/api";

export type RuntimeSetting = {
  id: string;
  label: string;
  value: string;
  detail: string;
  apply: (value: string) => AppSettingsUpdate;
  inputMode?: "text" | "number" | "select";
  options?: { label: string; value: string }[];
};

export function runtimeSettings(settings: NonNullable<UsePrivacySafetyResult["settings"]>): RuntimeSetting[] {
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

export function displayRuntimeValue(row: RuntimeSetting) {
  if (row.inputMode !== "select") {
    return row.value || "auto";
  }
  return row.options?.find((option) => option.value === row.value)?.label ?? row.value;
}

export function runtimeDraftIsValid(row: RuntimeSetting, draft: string) {
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
