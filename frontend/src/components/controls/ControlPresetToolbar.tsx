import { Play, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { ControlGroup } from "../../domains/controls/grouping";
import type { UseControlPresetsResult } from "../../hooks/useControlPresets";
import type { UseControlsResult } from "../../hooks/useControls";
import type { ControlPreset, ControlPresetScope, V4L2Control } from "../../types/api";

type Props = {
  group: ControlGroup;
  controls: UseControlsResult;
  controlPresets: UseControlPresetsResult;
};

const APPLY_ORDER: Record<ControlPresetScope, string[]> = {
  image: ["white_balance_automatic", "white_balance_temperature"],
  focus: ["focus_automatic_continuous", "focus_absolute"],
  exposure: ["auto_exposure", "exposure_time_absolute", "gain"]
};

export function ControlPresetToolbar({ group, controls, controlPresets }: Props) {
  const scope = presetScopeForGroup(group.id);
  const [selectedId, setSelectedId] = useState("");
  const [presetName, setPresetName] = useState("");
  const presets = scope ? controlPresets.presetsForScope(scope) : [];
  const selectedPreset = presets.find((preset) => preset.id === selectedId) ?? null;
  const saveValues = useMemo(() => (scope ? collectActiveValues(scope, group.controls) : []), [group.controls, scope]);
  const busy = controls.pendingControl !== null || controlPresets.pendingPresetId !== null;

  if (!scope) {
    return null;
  }

  const saveCurrent = async () => {
    const saved = await controlPresets.savePreset(scope, presetName, saveValues);
    if (saved) {
      setSelectedId(saved.id);
      setPresetName("");
    }
  };

  const applySelected = async () => {
    if (!selectedPreset) {
      return;
    }
    await controls.setValues(valuesForApply(scope, selectedPreset, group.controls));
  };

  const deleteSelected = async () => {
    if (!selectedPreset) {
      return;
    }
    await controlPresets.deletePreset(selectedPreset.id);
    setSelectedId("");
  };

  return (
    <div className="control-preset-toolbar">
      <select
        className="preset-select"
        value={selectedId}
        disabled={busy || controlPresets.isLoading}
        onChange={(event) => setSelectedId(event.target.value)}
        aria-label={`${group.title} preset`}
      >
        <option value="">Select preset</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
      <button
        className="preset-icon-button"
        disabled={busy || !selectedPreset}
        onClick={() => void applySelected()}
        title="Apply preset"
        aria-label="Apply preset"
      >
        <Play size={14} />
      </button>
      <button
        className="preset-icon-button"
        disabled={busy || !selectedPreset}
        onClick={() => void deleteSelected()}
        title="Delete preset"
        aria-label="Delete preset"
      >
        <Trash2 size={14} />
      </button>
      <input
        className="preset-name-input"
        value={presetName}
        disabled={busy}
        onChange={(event) => setPresetName(event.target.value)}
        placeholder="Preset name"
        aria-label="Preset name"
      />
      <button
        className="preset-save-button"
        disabled={busy || !presetName.trim() || saveValues.length === 0}
        onClick={() => void saveCurrent()}
      >
        <Save size={14} />
        Save
      </button>
    </div>
  );
}

function presetScopeForGroup(groupId: ControlGroup["id"]): ControlPresetScope | null {
  if (groupId === "image" || groupId === "focus" || groupId === "exposure") {
    return groupId;
  }
  return null;
}

function collectActiveValues(scope: ControlPresetScope, controls: V4L2Control[]) {
  return orderedControls(scope, controls)
    .filter((control) => !control.flags.includes("inactive") && control.kind !== "unknown")
    .map((control) => ({ controlName: control.name, value: control.value }));
}

function valuesForApply(scope: ControlPresetScope, preset: ControlPreset, controls: V4L2Control[]) {
  const available = new Set(controls.map((control) => control.name));
  return orderedValueEntries(scope, preset.values)
    .filter(([controlName]) => available.has(controlName))
    .map(([controlName, value]) => ({ controlName, value }));
}

function orderedControls(scope: ControlPresetScope, controls: V4L2Control[]) {
  const priority = priorityMap(scope);
  return [...controls].sort((left, right) => {
    const leftPriority = priority.get(left.name) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(right.name) ?? Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority;
  });
}

function orderedValueEntries(scope: ControlPresetScope, values: Record<string, number>) {
  const priority = priorityMap(scope);
  return Object.entries(values).sort(([left], [right]) => {
    const leftPriority = priority.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority;
  });
}

function priorityMap(scope: ControlPresetScope) {
  return new Map(APPLY_ORDER[scope].map((controlName, index) => [controlName, index]));
}
