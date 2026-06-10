import { describe, expect, it } from "vitest";

import { focusPointFromContainClick } from "./focusPoint";

describe("focusPointFromContainClick", () => {
  it("maps a centered click to the HID coordinate range", () => {
    expect(
      focusPointFromContainClick(
        { width: 1280, height: 720 },
        { width: 1280, height: 720 },
        { x: 640, y: 360 }
      )
    ).toEqual({ x: 64, y: 64 });
  });

  it("ignores clicks in object-fit contain letterbox space", () => {
    expect(
      focusPointFromContainClick(
        { width: 1000, height: 500 },
        { width: 500, height: 500 },
        { x: 100, y: 250 }
      )
    ).toBeNull();
  });

  it("maps clicks inside the rendered image when letterboxed", () => {
    expect(
      focusPointFromContainClick(
        { width: 1000, height: 500 },
        { width: 500, height: 500 },
        { x: 500, y: 250 }
      )
    ).toEqual({ x: 64, y: 64 });
  });
});
