import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Crosshair } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import type { ControlGroup } from "../../domains/controls/grouping";
import type { UseControlsResult } from "../../hooks/useControls";
import type { V4L2Control } from "../../types/api";
import { PtzControlPanel } from "./PtzControlPanel";

function control(overrides: Partial<V4L2Control>): V4L2Control {
  return {
    name: "pan_absolute",
    label: "Pan",
    control_id: "0x1",
    group: "Camera Controls",
    kind: "int",
    value: 0,
    default: 0,
    min: -100,
    max: 100,
    step: 10,
    value_label: null,
    flags: [],
    menu: [],
    ...overrides
  };
}

function renderPanel(setValue = vi.fn().mockResolvedValue(undefined)) {
  const group: ControlGroup = {
    id: "ptz",
    title: "PTZ Drive",
    accent: "cyan",
    icon: Crosshair,
    controls: [
      control({ name: "pan_absolute", label: "Pan", value: 20 }),
      control({ name: "tilt_absolute", label: "Tilt", value: 30 }),
      control({ name: "zoom_absolute", label: "Zoom", value: 50, min: 0, max: 80, step: 5 })
    ]
  };
  const controls: UseControlsResult = {
    controls: group.controls,
    groups: [group],
    isLoading: false,
    error: null,
    pendingControl: null,
    refresh: vi.fn(),
    setValue
  };

  render(<PtzControlPanel group={group} controls={controls} />);
  return setValue;
}

describe("PtzControlPanel", () => {
  it("moves pan by the exposed V4L2 step", async () => {
    const user = userEvent.setup();
    const setValue = renderPanel();

    await user.click(screen.getByRole("button", { name: "Pan left" }));

    expect(setValue).toHaveBeenCalledWith("pan_absolute", -10);
  });

  it("centers pan and tilt controls", async () => {
    const user = userEvent.setup();
    const setValue = renderPanel();

    await user.click(screen.getByRole("button", { name: "Center PTZ" }));

    expect(setValue).toHaveBeenCalledWith("pan_absolute", 0);
    expect(setValue).toHaveBeenCalledWith("tilt_absolute", 0);
  });

  it("sets zoom from the visible zoom slider", () => {
    const setValue = renderPanel();

    const zoomSlider = screen.getAllByRole("slider")[2];
    fireEvent.change(zoomSlider, { target: { value: "65" } });
    fireEvent.blur(zoomSlider);

    expect(setValue).toHaveBeenCalledWith("zoom_absolute", 65);
  });

  it("saves and recalls a PTZ preset", async () => {
    const user = userEvent.setup();
    const setValue = renderPanel();

    await user.click(screen.getByRole("button", { name: "Save PTZ preset" }));
    await user.click(screen.getByRole("button", { name: "Goto PTZ preset" }));

    expect(setValue).toHaveBeenCalledWith("pan_absolute", 20);
    expect(setValue).toHaveBeenCalledWith("tilt_absolute", 30);
    expect(setValue).toHaveBeenCalledWith("zoom_absolute", 50);
  });

  it("allows speed selection for PTZ jog controls", async () => {
    const user = userEvent.setup();
    const setValue = renderPanel();

    await user.click(screen.getByRole("button", { name: "Speed 1" }));
    await user.click(screen.getByRole("button", { name: "Pan right" }));

    expect(setValue).toHaveBeenCalledWith("pan_absolute", 30);
  });
});
