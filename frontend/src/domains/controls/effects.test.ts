import { describe, expect, it } from "vitest";

import type { V4L2Control } from "../../types/api";
import { effectValuesForControls, IMAGE_EFFECTS } from "./effects";

function control(name: string): V4L2Control {
  return {
    name,
    label: name,
    control_id: "0x1",
    group: "Image",
    kind: "int",
    value: 0,
    default: null,
    min: 0,
    max: 255,
    step: 1,
    value_label: null,
    flags: [],
    menu: []
  };
}

describe("image effects", () => {
  it("uses the captured Nostalgia values in device-safe order", () => {
    const nostalgia = IMAGE_EFFECTS.find((effect) => effect.id === "nostalgia");

    expect(nostalgia?.values).toMatchObject({
      brightness: 128,
      contrast: 128,
      sharpness: 80,
      saturation: 100,
      hue: 128,
      white_balance_automatic: 0,
      white_balance_temperature: 7500
    });
  });

  it("only emits controls available on the selected device", () => {
    const blue = IMAGE_EFFECTS.find((effect) => effect.id === "blue");

    const values = effectValuesForControls(blue!, [control("brightness"), control("white_balance_temperature")]);

    expect(values).toEqual([
      { controlName: "brightness", value: 128 },
      { controlName: "white_balance_temperature", value: 4250 }
    ]);
  });
});
