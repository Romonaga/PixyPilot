import { useEffect, useState } from "react";

import { controlValueText } from "../../domains/controls/grouping";
import type { ControlGroup } from "../../domains/controls/grouping";
import type { UseControlsResult } from "../../hooks/useControls";
import type { V4L2Control } from "../../types/api";

type Props = {
  group: ControlGroup;
  controls: UseControlsResult;
};

const GROUP_ORDER: Partial<Record<ControlGroup["id"], string[]>> = {
  image: [
    "white_balance_automatic",
    "white_balance_temperature",
    "brightness",
    "contrast",
    "saturation",
    "sharpness",
    "hue",
    "gamma",
    "gain",
    "power_line_frequency",
    "backlight_compensation"
  ],
  focus: ["focus_automatic_continuous", "focus_absolute"],
  exposure: ["auto_exposure", "exposure_time_absolute"]
};

export function CompactControlPanel({ group, controls }: Props) {
  const Icon = group.icon;
  const orderedControls = orderControls(group.controls, GROUP_ORDER[group.id] ?? []);

  return (
    <section className={`control-panel reference-control-panel control-panel-${group.id} accent-${group.accent}`}>
      <div className="panel-title-row">
        <Icon size={18} />
        <h2>{group.title}</h2>
      </div>
      <div className="reference-control-stack">
        {orderedControls.map((control) => (
          <CompactControlRow
            key={control.name}
            control={control}
            disabled={controls.pendingControl === control.name}
            onSetValue={(value) => controls.setValue(control.name, value)}
          />
        ))}
      </div>
    </section>
  );
}

function orderControls(controls: V4L2Control[], preferredOrder: string[]) {
  const priority = new Map(preferredOrder.map((name, index) => [name, index]));
  return [...controls].sort((left, right) => {
    const leftPriority = priority.get(left.name) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(right.name) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.label.localeCompare(right.label);
  });
}

type RowProps = {
  control: V4L2Control;
  disabled: boolean;
  onSetValue: (value: number) => Promise<void>;
};

function CompactControlRow({ control, disabled, onSetValue }: RowProps) {
  const isInactive = control.flags.includes("inactive");
  const unavailable = disabled || isInactive;
  const hasPresets = control.kind === "bool" || (control.kind === "menu" && control.menu.length > 0 && control.menu.length <= 4);

  return (
    <div className={`reference-control-row ${hasPresets ? "has-presets" : ""} ${isInactive ? "is-inactive" : ""}`}>
      <div className="reference-control-label">
        <span>{control.label}</span>
        {isInactive && <small>Auto mode active</small>}
      </div>
      <div className="reference-control-input">
        <CompactInput control={control} disabled={unavailable} onSetValue={onSetValue} />
      </div>
      {!hasPresets && <output>{controlValueText(control)}</output>}
    </div>
  );
}

function CompactInput({ control, disabled, onSetValue }: RowProps) {
  if (control.kind === "bool") {
    return (
      <div className="reference-segmented two-up">
        {boolOptions(control).map((option) => (
          <button
            key={option.value}
            className={control.value === option.value ? "is-selected" : ""}
            disabled={disabled}
            onClick={() => void onSetValue(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  if (control.kind === "menu" && control.menu.length > 0 && control.menu.length <= 4) {
    return (
      <div className={`reference-segmented columns-${control.menu.length}`}>
        {control.menu.map((option) => (
          <button
            key={option.value}
            className={control.value === option.value ? "is-selected" : ""}
            disabled={disabled}
            onClick={() => void onSetValue(option.value)}
          >
            {shortPresetLabel(option.label)}
          </button>
        ))}
      </div>
    );
  }

  if (control.kind === "menu") {
    return (
      <select
        className="menu-select"
        value={control.value}
        disabled={disabled}
        onChange={(event) => void onSetValue(Number(event.target.value))}
      >
        {control.menu.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return <CompactRangeInput control={control} disabled={disabled} onSetValue={onSetValue} />;
}

function CompactRangeInput({ control, disabled, onSetValue }: RowProps) {
  const [draftValue, setDraftValue] = useState(control.value);

  useEffect(() => {
    setDraftValue(control.value);
  }, [control.value]);

  return (
    <input
      className="range-input"
      type="range"
      min={control.min ?? 0}
      max={control.max ?? 100}
      step={control.step && control.step > 0 ? control.step : 1}
      value={draftValue}
      disabled={disabled}
      onChange={(event) => setDraftValue(Number(event.target.value))}
      onBlur={() => void onSetValue(draftValue)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          void onSetValue(draftValue);
        }
      }}
    />
  );
}

function boolOptions(control: V4L2Control) {
  if (control.name.includes("automatic") || control.name.includes("auto")) {
    return [
      { value: 1, label: "Auto" },
      { value: 0, label: "Manual" }
    ];
  }
  return [
    { value: 0, label: "Off" },
    { value: 1, label: "On" }
  ];
}

function shortPresetLabel(label: string) {
  return label.replace(" Priority Mode", "").replace(" Mode", "").replace("Frequency", "").trim();
}
