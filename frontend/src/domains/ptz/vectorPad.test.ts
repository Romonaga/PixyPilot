import { describe, expect, it } from "vitest";

import { isCenteredVector, ptzVectorFromPadPoint, vectorPadPosition } from "./vectorPad";

describe("ptz vector pad geometry", () => {
  it("maps the pad center to a centered vector", () => {
    expect(ptzVectorFromPadPoint({ width: 200, height: 200 }, { x: 100, y: 100 })).toEqual({
      x: 0,
      y: 0
    });
  });

  it("maps right and up to positive HID vector values", () => {
    expect(ptzVectorFromPadPoint({ width: 200, height: 200 }, { x: 200, y: 0 })).toEqual({
      x: 21.2,
      y: 21.2
    });
  });

  it("clamps points outside the round pad to the vector limit", () => {
    expect(ptzVectorFromPadPoint({ width: 200, height: 200 }, { x: 400, y: 100 })).toEqual({
      x: 30,
      y: 0
    });
  });

  it("converts a vector back to a percentage puck position", () => {
    expect(vectorPadPosition({ x: 15, y: -30 })).toEqual({
      x: 75,
      y: 100
    });
  });

  it("treats tiny vectors as centered", () => {
    expect(isCenteredVector({ x: 0.2, y: -0.4 })).toBe(true);
    expect(isCenteredVector({ x: 1, y: 0 })).toBe(false);
  });
});
