import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { V4L2Control } from "../../types/api";
import { ControlRenderer } from "./ControlRenderer";

function baseControl(overrides: Partial<V4L2Control>): V4L2Control {
  return {
    name: "brightness",
    label: "Brightness",
    control_id: "0x1",
    group: "User Controls",
    kind: "int",
    value: 10,
    default: 10,
    min: 0,
    max: 100,
    step: 1,
    value_label: null,
    flags: [],
    menu: [],
    ...overrides
  };
}

describe("ControlRenderer", () => {
  it("renders boolean controls as toggles and calls setter", async () => {
    const user = userEvent.setup();
    const onSetValue = vi.fn().mockResolvedValue(undefined);

    render(
      <ControlRenderer
        control={baseControl({ kind: "bool", value: 1 })}
        disabled={false}
        onSetValue={onSetValue}
      />
    );

    await user.click(screen.getByRole("button", { pressed: true }));

    expect(onSetValue).toHaveBeenCalledWith(0);
  });

  it("renders menu controls with option labels", () => {
    render(
      <ControlRenderer
        control={baseControl({
          kind: "menu",
          value: 3,
          value_label: "Aperture Priority Mode",
          menu: [
            { value: 1, label: "Manual Mode" },
            { value: 3, label: "Aperture Priority Mode" }
          ]
        })}
        disabled={false}
        onSetValue={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toHaveValue("3");
    expect(screen.getByText("Manual Mode")).toBeInTheDocument();
  });
});
