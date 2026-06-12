import { Check, FileCog, Pencil, X } from "lucide-react";

import { displayRuntimeValue, runtimeDraftIsValid, type RuntimeSetting } from "./runtimeSettings";

type ReadOnlyProps = {
  label: string;
  value: string;
};

export function ReadOnlyRuntimeRow({ label, value }: ReadOnlyProps) {
  return (
    <div className="runtime-row">
      <FileCog size={14} />
      <span>{label}</span>
      <code title={value}>{value}</code>
      <span className="runtime-badge">read</span>
    </div>
  );
}

type EditableProps = {
  row: RuntimeSetting;
  disabled: boolean;
  editing: boolean;
  draft: string;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
};

export function EditableRuntimeRow({
  row,
  disabled,
  editing,
  draft,
  onCancel,
  onDraftChange,
  onEdit,
  onSave
}: EditableProps) {
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
        <code title={row.value}>{displayRuntimeValue(row)}</code>
      )}
      {editing ? (
        <div className="runtime-actions">
          <button className="icon-button" disabled={disabled || !runtimeDraftIsValid(row, draft)} aria-label={`Save ${row.label}`} onClick={onSave}>
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
