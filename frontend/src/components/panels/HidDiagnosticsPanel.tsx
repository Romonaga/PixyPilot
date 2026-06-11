import { Clipboard, DatabaseZap, Download, Microscope, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { capturePixyHidDiagnostics } from "../../lib/apiClient";
import type { PixyHidDiagnosticSnapshot, PixyHidRawQueryResult } from "../../types/api";

export function HidDiagnosticsPanel() {
  const [snapshot, setSnapshot] = useState<PixyHidDiagnosticSnapshot | null>(null);
  const [pending, setPending] = useState<"capture" | "save" | "copy" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snapshotText = useMemo(() => (snapshot ? JSON.stringify(snapshot, null, 2) : ""), [snapshot]);

  const capture = async (save: boolean) => {
    setPending(save ? "save" : "capture");
    setMessage(null);
    setError(null);
    try {
      const result = await capturePixyHidDiagnostics(save);
      setSnapshot(result);
      setMessage(save && result.file_path ? `Saved ${result.file_path}` : "Snapshot captured");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to capture HID diagnostics");
    } finally {
      setPending(null);
    }
  };

  const copySnapshot = async () => {
    if (!snapshotText) {
      return;
    }
    setPending("copy");
    setMessage(null);
    setError(null);
    try {
      await navigator.clipboard.writeText(snapshotText);
      setMessage("Snapshot copied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to copy snapshot");
    } finally {
      setPending(null);
    }
  };

  const downloadSnapshot = () => {
    if (!snapshotText) {
      return;
    }
    const blob = new Blob([snapshotText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pixypilot-hid-${snapshot?.captured_at.replace(/[:+]/g, "") ?? "snapshot"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="hid-diagnostics-panel">
      <div className="panel-title-row">
        <Microscope size={18} />
        <h2>HID Diagnostics</h2>
      </div>

      <div className="diagnostic-actions">
        <button className="panel-action-button" disabled={pending !== null} onClick={() => void capture(false)}>
          <DatabaseZap size={14} />
          <span>{pending === "capture" ? "Reading" : "Capture"}</span>
        </button>
        <button className="panel-action-button" disabled={pending !== null} onClick={() => void capture(true)}>
          <Save size={14} />
          <span>{pending === "save" ? "Saving" : "Save"}</span>
        </button>
        <button className="icon-button" disabled={!snapshot || pending !== null} aria-label="Copy HID snapshot" onClick={() => void copySnapshot()}>
          <Clipboard size={15} />
        </button>
        <button className="icon-button" disabled={!snapshot} aria-label="Download HID snapshot" onClick={downloadSnapshot}>
          <Download size={15} />
        </button>
      </div>

      {error && <div className="mini-error">{error}</div>}
      {message && <div className="mini-success">{message}</div>}

      <div className="diagnostic-summary">
        <span>{snapshot?.captured_at ?? "No capture yet"}</span>
        <code>{snapshot?.path ?? "hidraw pending"}</code>
      </div>

      <div className="diagnostic-query-list">
        {(snapshot?.queries ?? []).map((query) => (
          <DiagnosticQueryRow key={query.name} query={query} />
        ))}
        {!snapshot && <div className="empty-state">Run Capture after changing camera modes.</div>}
      </div>
    </section>
  );
}

function DiagnosticQueryRow({ query }: { query: PixyHidRawQueryResult }) {
  return (
    <div className="diagnostic-query-row">
      <div>
        <strong>{query.name.replaceAll("_", " ")}</strong>
        <small>{query.response_hex ?? "no response"}</small>
      </div>
      <div className="diagnostic-value-stack">
        <code>{query.raw_value === null ? "--" : `0x${query.raw_value.toString(16).padStart(2, "0")}`}</code>
        <span>{query.raw_bits.length ? `bits ${query.raw_bits.join(",")}` : "bits none"}</span>
      </div>
      {(query.ascii_value || query.ascii_preview) && (
        <small className="diagnostic-ascii">
          ASCII {query.ascii_value ? `${query.ascii_value} | ` : ""}
          {query.ascii_preview}
        </small>
      )}
    </div>
  );
}
