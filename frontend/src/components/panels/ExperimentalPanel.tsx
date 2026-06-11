import { Clipboard, Download, FlaskConical, Save, SearchCode } from "lucide-react";
import { useMemo, useState } from "react";

import { captureUvcExtensionSnapshot } from "../../lib/apiClient";
import type { UvcExtensionSelectorProbe, UvcExtensionSnapshot } from "../../types/api";

type Props = {
  deviceName: string | null;
};

export function ExperimentalPanel({ deviceName }: Props) {
  const [snapshot, setSnapshot] = useState<UvcExtensionSnapshot | null>(null);
  const [pending, setPending] = useState<"probe" | "save" | "copy" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const snapshotText = useMemo(() => (snapshot ? JSON.stringify(snapshot, null, 2) : ""), [snapshot]);
  const disabled = !deviceName || pending !== null;

  const probe = async (save: boolean) => {
    if (!deviceName) {
      setError("Select a capture device first");
      return;
    }
    setPending(save ? "save" : "probe");
    setMessage(null);
    setError(null);
    try {
      const result = await captureUvcExtensionSnapshot(deviceName, save);
      setSnapshot(result);
      setMessage(save && result.file_path ? `Saved ${result.file_path}` : "Selectors probed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to probe UVC extension selectors");
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
      setMessage("UVC snapshot copied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to copy UVC snapshot");
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
    link.download = `pixypilot-uvc-${deviceName ?? "device"}-${snapshot?.captured_at.replace(/[:+]/g, "") ?? "snapshot"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="experimental-panel">
      <div className="panel-title-row">
        <FlaskConical size={18} />
        <h2>Future Deck</h2>
      </div>
      <div className="uvc-diagnostics-card">
        <div className="uvc-diagnostics-header">
          <div>
            <strong>UVC Extension</strong>
            <span>{deviceName ? `${deviceName} unit 2 selectors 1-10` : "Select a capture device"}</span>
          </div>
          <em>Read only</em>
        </div>
        <div className="diagnostic-actions">
          <button className="panel-action-button" disabled={disabled} onClick={() => void probe(false)}>
            <SearchCode size={14} />
            <span>{pending === "probe" ? "Probing" : "Probe"}</span>
          </button>
          <button className="panel-action-button" disabled={disabled} onClick={() => void probe(true)}>
            <Save size={14} />
            <span>{pending === "save" ? "Saving" : "Save"}</span>
          </button>
          <button className="icon-button" disabled={!snapshot || pending !== null} aria-label="Copy UVC snapshot" onClick={() => void copySnapshot()}>
            <Clipboard size={15} />
          </button>
          <button className="icon-button" disabled={!snapshot} aria-label="Download UVC snapshot" onClick={downloadSnapshot}>
            <Download size={15} />
          </button>
        </div>
        {error && <div className="mini-error">{error}</div>}
        {message && <div className="mini-success">{message}</div>}
        {snapshot?.previous_file_path && (
          <div className="uvc-correlation-summary">
            <span>Compared with latest saved baseline</span>
            <strong>
              {snapshot.changed_selectors.length > 0
                ? `Changed selectors ${snapshot.changed_selectors.join(", ")}`
                : "No selector changes"}
            </strong>
          </div>
        )}
        <div className="uvc-selector-list">
          {(snapshot?.selectors ?? []).map((selector) => (
            <UvcSelectorRow key={selector.selector} selector={selector} />
          ))}
          {!snapshot && <div className="empty-state">Probe after changing a camera mode to correlate raw selector values.</div>}
        </div>
      </div>
    </section>
  );
}

function UvcSelectorRow({ selector }: { selector: UvcExtensionSelectorProbe }) {
  const currentHex = selector.current?.hex_value ?? "--";
  const flags = [
    ...selector.info_flags,
    selector.length !== null ? `${selector.length}B` : null
  ].filter(Boolean);
  const valueSummary = [
    `min:${uvcValueHex(selector.minimum)}`,
    `def:${uvcValueHex(selector.default)}`,
    `max:${uvcValueHex(selector.maximum)}`,
    `res:${uvcValueHex(selector.resolution)}`
  ]
    .join(" ");

  return (
    <div className={`uvc-selector-row${selector.changed_since_previous ? " is-changed" : ""}`}>
      <div>
        <strong>
          Selector {selector.selector}
          {selector.changed_since_previous && <em>Changed</em>}
        </strong>
        <small>
          cur:{currentHex}
          {selector.current?.int_value !== null && selector.current?.int_value !== undefined ? ` int:${selector.current.int_value}` : ""}
        </small>
        <small>{valueSummary}</small>
        {selector.current?.ascii_preview && <small className="diagnostic-ascii">ASCII {selector.current.ascii_preview}</small>}
        {selector.changed_fields.length > 0 && <small className="uvc-selector-change-fields">Fields {selector.changed_fields.join(", ")}</small>}
        {selector.errors.length > 0 && <small className="uvc-selector-error">{selector.errors.join("; ")}</small>}
      </div>
      <div className="diagnostic-value-stack">
        <code>{selector.info === null ? "--" : `0x${selector.info.toString(16).padStart(2, "0")}`}</code>
        <span>{flags.join(" ") || "unknown"}</span>
      </div>
    </div>
  );
}

function uvcValueHex(value: UvcExtensionSelectorProbe["current"]): string {
  return value?.ok ? value.hex_value ?? "--" : "--";
}
