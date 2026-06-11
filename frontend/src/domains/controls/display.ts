import type { V4L2Control } from "../../types/api";

export type ControlDependencyAction = {
  parentName: string;
  value: number;
  label: string;
};

const LABEL_OVERRIDES: Record<string, string> = {
  auto_exposure: "AE Mode",
  exposure_time_absolute: "Exposure",
  gain: "ISO",
  hue: "Tone",
  white_balance_automatic: "AWB",
  white_balance_temperature: "WB"
};

export function controlDisplayLabel(control: V4L2Control): string {
  return LABEL_OVERRIDES[control.name] ?? control.label;
}

export function inactiveReason(control: V4L2Control): string {
  if (control.name === "white_balance_temperature") {
    return "Set AWB to Lock";
  }
  if (control.name === "exposure_time_absolute") {
    return "Set AE Mode to Manual";
  }
  if (control.name === "focus_absolute") {
    return "Set Focus Mode to Manual";
  }
  return "Auto mode active";
}

export function dependencyHint(control: V4L2Control, controls: V4L2Control[]): string | null {
  if (!control.flags.includes("inactive")) {
    return null;
  }

  if (control.name === "white_balance_temperature") {
    return statefulHint(controls, "white_balance_automatic", "AWB", "Lock");
  }
  if (control.name === "exposure_time_absolute") {
    return statefulHint(controls, "auto_exposure", "AE Mode", "Manual");
  }
  if (control.name === "focus_absolute") {
    return statefulHint(controls, "focus_automatic_continuous", "Focus Mode", "Manual");
  }

  return inactiveReason(control);
}

export function dependencyAction(control: V4L2Control, controls: V4L2Control[]): ControlDependencyAction | null {
  if (!control.flags.includes("inactive")) {
    return null;
  }

  if (control.name === "white_balance_temperature" && hasControl(controls, "white_balance_automatic")) {
    return { parentName: "white_balance_automatic", value: 0, label: "Lock WB" };
  }
  if (control.name === "exposure_time_absolute" && hasControl(controls, "auto_exposure")) {
    return { parentName: "auto_exposure", value: 1, label: "Manual AE" };
  }
  if (control.name === "focus_absolute" && hasControl(controls, "focus_automatic_continuous")) {
    return { parentName: "focus_automatic_continuous", value: 0, label: "Manual Focus" };
  }

  return null;
}

export function boolOptionLabels(control: V4L2Control): { value: number; label: string }[] {
  if (control.name === "white_balance_automatic") {
    return [
      { value: 1, label: "Auto" },
      { value: 0, label: "Lock" }
    ];
  }
  if (control.name === "focus_automatic_continuous") {
    return [
      { value: 1, label: "Auto" },
      { value: 0, label: "Manual" }
    ];
  }
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

function hasControl(controls: V4L2Control[], name: string): boolean {
  return controls.some((control) => control.name === name);
}

function statefulHint(controls: V4L2Control[], parentName: string, parentLabel: string, targetLabel: string): string {
  const parent = controls.find((control) => control.name === parentName);
  if (!parent) {
    return `Set ${parentLabel} to ${targetLabel}`;
  }

  const valueLabel = parent.value_label ?? parent.menu.find((option) => option.value === parent.value)?.label;
  if (!valueLabel) {
    return `Set ${parentLabel} to ${targetLabel}`;
  }

  return `${parentLabel}: ${shortDependencyLabel(valueLabel)}. Set to ${targetLabel}.`;
}

function shortDependencyLabel(label: string): string {
  if (label === "Aperture Priority Mode") {
    return "Auto";
  }
  return label.replace(" Priority Mode", "").replace(" Mode", "").trim();
}
