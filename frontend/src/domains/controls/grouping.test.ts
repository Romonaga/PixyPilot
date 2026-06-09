import { describe, expect, it } from "vitest";

import type { V4L2Control } from "../../types/api";
import { groupControls } from "./grouping";

function control(name: string): V4L2Control {
  return {
    name,
    label: name,
    control_id: "0x1",
    group: "Camera Controls",
    kind: "int",
    value: 0,
    default: 0,
    min: 0,
    max: 10,
    step: 1,
    value_label: null,
    flags: [],
    menu: []
  };
}

describe("groupControls", () => {
  it("places known controls into domain groups", () => {
    const groups = groupControls([
      control("pan_absolute"),
      control("brightness"),
      control("focus_absolute"),
      control("auto_exposure")
    ]);

    expect(groups.find((group) => group.id === "ptz")?.controls).toHaveLength(1);
    expect(groups.find((group) => group.id === "image")?.controls).toHaveLength(1);
    expect(groups.find((group) => group.id === "focus")?.controls).toHaveLength(1);
    expect(groups.find((group) => group.id === "exposure")?.controls).toHaveLength(1);
  });
});
