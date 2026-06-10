import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Aperture, Focus, SlidersHorizontal } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import type { ControlGroup } from "../../domains/controls/grouping";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { V4L2Control } from "../../types/api";
import { CompactControlPanel } from "./CompactControlPanel";

function control(overrides: Partial<V4L2Control>): V4L2Control {
  return {
    name: "focus_automatic_continuous",
    label: "Focus Auto",
    control_id: "0x1",
    group: "Camera Controls",
    kind: "bool",
    value: 1,
    default: 1,
    min: null,
    max: null,
    step: null,
    value_label: null,
    flags: [],
    menu: [],
    ...overrides
  };
}

function pixyHid(overrides: Partial<UsePixyHidResult> = {}): UsePixyHidResult {
  return {
    status: {
      available: true,
      path: "/dev/hidraw14",
      readable: true,
      writable: true,
      reason: null,
      known_controls: ["focus_metering"]
    },
    isLoading: false,
    pendingCommand: null,
    error: null,
    lastCommand: null,
    trackingMode: null,
    gestureEnabled: null,
    autoRotateEnabled: null,
    mirrorMode: null,
    focusMeteringMode: null,
    audioMode: null,
    autoPrivacySeconds: null,
    refresh: vi.fn(),
    setTrackingMode: vi.fn(),
    setGestureEnabled: vi.fn(),
    setAutoRotateEnabled: vi.fn(),
    setMirrorMode: vi.fn(),
    setFocusMeteringMode: vi.fn(),
    setAudioMode: vi.fn(),
    setAutoPrivacySeconds: vi.fn(),
    sendPtzDirection: vi.fn(),
    sendPtzVector: vi.fn(),
    savePtzPreset: vi.fn(),
    loadPtzPreset: vi.fn(),
    ...overrides
  };
}

describe("CompactControlPanel", () => {
  it("exposes captured focus metering modes in the focus panel", async () => {
    const user = userEvent.setup();
    const setFocusMeteringMode = vi.fn().mockResolvedValue(undefined);
    const group: ControlGroup = {
      id: "focus",
      title: "Focus Control",
      accent: "magenta",
      icon: Focus,
      controls: [
        control({ name: "focus_automatic_continuous", label: "Focus Mode" }),
        control({ name: "focus_absolute", label: "Focus Position", kind: "int", value: 128, min: 0, max: 1023, step: 1 })
      ]
    };
    const controls: UseControlsResult = {
      controls: group.controls,
      groups: [group],
      isLoading: false,
      error: null,
      pendingControl: null,
      refresh: vi.fn(),
      setValue: vi.fn(),
      setValues: vi.fn()
    };

    render(
      <CompactControlPanel
        group={group}
        controls={controls}
        pixyHid={pixyHid({ setFocusMeteringMode })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Person" }));

    expect(setFocusMeteringMode).toHaveBeenCalledWith("human_face");
  });

  it("uses captured vendor labels for custom image controls", () => {
    const group: ControlGroup = {
      id: "image",
      title: "Image Control",
      accent: "lime",
      icon: SlidersHorizontal,
      controls: [
        control({ name: "hue", label: "Hue", kind: "int", value: 128, min: 0, max: 255, step: 1 }),
        control({ name: "white_balance_automatic", label: "White Balance, Automatic", kind: "bool", value: 0 }),
        control({
          name: "white_balance_temperature",
          label: "White Balance Temperature",
          kind: "int",
          value: 2300,
          min: 2300,
          max: 7500,
          step: 1
        })
      ]
    };
    const controls: UseControlsResult = {
      controls: group.controls,
      groups: [group],
      isLoading: false,
      error: null,
      pendingControl: null,
      refresh: vi.fn(),
      setValue: vi.fn(),
      setValues: vi.fn()
    };

    render(<CompactControlPanel group={group} controls={controls} pixyHid={pixyHid()} />);

    expect(screen.getByText("Tone")).toBeInTheDocument();
    expect(screen.getByText("AWB")).toBeInTheDocument();
    expect(screen.getByText("WB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lock" })).toBeInTheDocument();
  });

  it("labels gain as ISO in exposure control", () => {
    const group: ControlGroup = {
      id: "exposure",
      title: "Exposure Control",
      accent: "amber",
      icon: Aperture,
      controls: [control({ name: "gain", label: "Gain", kind: "int", value: 1, min: 0, max: 100, step: 1 })]
    };
    const controls: UseControlsResult = {
      controls: group.controls,
      groups: [group],
      isLoading: false,
      error: null,
      pendingControl: null,
      refresh: vi.fn(),
      setValue: vi.fn(),
      setValues: vi.fn()
    };

    render(<CompactControlPanel group={group} controls={controls} pixyHid={pixyHid()} />);

    expect(screen.getByText("ISO")).toBeInTheDocument();
  });
});
