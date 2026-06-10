import type { V4L2Control } from "../../types/api";

const LABEL_OVERRIDES: Record<string, string> = {
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
    return "AWB enabled";
  }
  if (control.name === "exposure_time_absolute") {
    return "AE mode active";
  }
  if (control.name === "focus_absolute") {
    return "Auto focus active";
  }
  return "Auto mode active";
}

export function boolOptionLabels(control: V4L2Control): { value: number; label: string }[] {
  if (control.name === "white_balance_automatic") {
    return [
      { value: 1, label: "Auto" },
      { value: 0, label: "Lock" }
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
