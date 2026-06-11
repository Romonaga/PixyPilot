import { FileUp, FolderInput, RefreshCw, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchPcapImports, uploadPcapImport } from "../../lib/apiClient";
import type { PcapImportRecord } from "../../types/api";

export function PcapImportPanel() {
  const [captures, setCaptures] = useState<PcapImportRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [action, setAction] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"load" | "upload" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recentCaptures = useMemo(() => captures.slice(0, 4), [captures]);

  const refresh = async () => {
    setPending("load");
    setError(null);
    try {
      setCaptures(await fetchPcapImports());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load imported captures");
    } finally {
      setPending(null);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const upload = async () => {
    if (!selectedFile) {
      setError("Select a .pcap or .pcapng file first");
      return;
    }
    setPending("upload");
    setMessage(null);
    setError(null);
    try {
      const record = await uploadPcapImport(selectedFile, {
        action,
        notes,
        source: "windows"
      });
      setCaptures((current) => [record, ...current.filter((capture) => capture.id !== record.id)]);
      setSelectedFile(null);
      setAction("");
      setNotes("");
      setMessage(`Imported ${record.original_filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import capture");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="pcap-import-panel">
      <div className="panel-title-row">
        <FolderInput size={18} />
        <h2>Windows Capture Inbox</h2>
      </div>

      <div className="pcap-upload-card">
        <label className="pcap-file-picker">
          <FileUp size={15} />
          <span>{selectedFile ? selectedFile.name : "Select pcap"}</span>
          <input
            type="file"
            accept=".pcap,.pcapng,application/vnd.tcpdump.pcap"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <input
          className="pcap-text-input"
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="Action changed"
        />
        <textarea
          className="pcap-text-input"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes"
          rows={2}
        />
        <div className="diagnostic-actions">
          <button className="panel-action-button" disabled={pending !== null || !selectedFile} onClick={() => void upload()}>
            <UploadCloud size={14} />
            <span>{pending === "upload" ? "Uploading" : "Upload"}</span>
          </button>
          <button className="icon-button" disabled={pending !== null} aria-label="Refresh imports" onClick={() => void refresh()}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {error && <div className="mini-error">{error}</div>}
      {message && <div className="mini-success">{message}</div>}

      <div className="pcap-import-list">
        {recentCaptures.map((capture) => (
          <PcapImportRow key={capture.id} capture={capture} />
        ))}
        {recentCaptures.length === 0 && <div className="empty-state">No imported captures yet.</div>}
      </div>
    </section>
  );
}

function PcapImportRow({ capture }: { capture: PcapImportRecord }) {
  return (
    <div className="pcap-import-row">
      <div>
        <strong>{capture.action || capture.original_filename}</strong>
        <small>{capture.original_filename}</small>
        <small>{capture.file_path}</small>
      </div>
      <div className="diagnostic-value-stack">
        <code>{formatBytes(capture.size_bytes)}</code>
        <span>{capture.sha256.slice(0, 8)}</span>
      </div>
    </div>
  );
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
