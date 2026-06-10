import {
  Aperture,
  Crosshair,
  Eye,
  Focus,
  LucideIcon,
  SlidersHorizontal,
  Sparkles,
  SunMedium
} from "lucide-react";

import type { V4L2Control } from "../../types/api";

export type ControlGroupId = "ptz" | "image" | "focus" | "exposure" | "smart" | "other";

export type ControlGroup = {
  id: ControlGroupId;
  title: string;
  accent: "cyan" | "lime" | "amber" | "magenta" | "violet" | "steel";
  icon: LucideIcon;
  controls: V4L2Control[];
};

const GROUP_DEFS: Omit<ControlGroup, "controls">[] = [
  { id: "ptz", title: "PTZ Control", accent: "cyan", icon: Crosshair },
  { id: "image", title: "Image Control", accent: "lime", icon: SlidersHorizontal },
  { id: "focus", title: "Focus Control", accent: "magenta", icon: Focus },
  { id: "exposure", title: "Exposure Control", accent: "amber", icon: Aperture },
  { id: "smart", title: "Smart Pixy", accent: "violet", icon: Sparkles },
  { id: "other", title: "Other Controls", accent: "steel", icon: SunMedium }
];

const GROUP_BY_CONTROL: Record<string, ControlGroupId> = {
  pan_absolute: "ptz",
  tilt_absolute: "ptz",
  zoom_absolute: "ptz",
  zoom_continuous: "ptz",
  brightness: "image",
  contrast: "image",
  saturation: "image",
  hue: "image",
  gamma: "image",
  gain: "exposure",
  sharpness: "image",
  white_balance_automatic: "image",
  white_balance_temperature: "image",
  power_line_frequency: "image",
  backlight_compensation: "image",
  focus_absolute: "focus",
  focus_automatic_continuous: "focus",
  auto_exposure: "exposure",
  exposure_time_absolute: "exposure"
};

export function groupControls(controls: V4L2Control[]): ControlGroup[] {
  const grouped = new Map<ControlGroupId, V4L2Control[]>();
  for (const control of controls) {
    const groupId = GROUP_BY_CONTROL[control.name] ?? "other";
    grouped.set(groupId, [...(grouped.get(groupId) ?? []), control]);
  }

  return GROUP_DEFS.map((definition) => ({
    ...definition,
    controls: grouped.get(definition.id) ?? []
  })).filter((group) => group.controls.length > 0 || group.id === "smart");
}

export function countActiveControls(controls: V4L2Control[]): number {
  return controls.filter((control) => !control.flags.includes("inactive")).length;
}

export function controlValueText(control: V4L2Control): string {
  if (control.kind === "bool") {
    return control.value === 1 ? "On" : "Off";
  }
  return control.value_label ?? String(control.value);
}

export { Eye };
