import type { V4L2Control } from "../../types/api";

export type ImageEffect = {
  id: string;
  label: string;
  values: Record<string, number>;
};

export const IMAGE_EFFECTS: ImageEffect[] = [
  {
    id: "bright",
    label: "Bright",
    values: {
      brightness: 180,
      contrast: 150,
      sharpness: 128,
      saturation: 128,
      hue: 128
    }
  },
  {
    id: "nostalgia",
    label: "Nostalgia",
    values: {
      brightness: 128,
      contrast: 128,
      sharpness: 80,
      saturation: 100,
      hue: 128,
      white_balance_automatic: 0,
      white_balance_temperature: 7500
    }
  },
  {
    id: "blue",
    label: "Blue",
    values: {
      brightness: 128,
      contrast: 128,
      sharpness: 128,
      saturation: 128,
      hue: 128,
      white_balance_automatic: 0,
      white_balance_temperature: 4250
    }
  },
  {
    id: "cold",
    label: "Cold",
    values: {
      brightness: 128,
      contrast: 70,
      sharpness: 255,
      saturation: 170,
      hue: 128,
      white_balance_automatic: 1
    }
  },
  {
    id: "vivid",
    label: "Vivid",
    values: {
      brightness: 170,
      contrast: 140,
      sharpness: 128,
      saturation: 140,
      hue: 128
    }
  },
  {
    id: "default",
    label: "Default",
    values: {
      brightness: 128,
      contrast: 128,
      sharpness: 128,
      saturation: 128,
      hue: 128,
      white_balance_automatic: 1
    }
  }
];

export function effectValuesForControls(effect: ImageEffect, controls: V4L2Control[]) {
  const available = new Set(controls.map((control) => control.name));
  return Object.entries(effect.values)
    .filter(([controlName]) => available.has(controlName))
    .map(([controlName, value]) => ({ controlName, value }));
}
