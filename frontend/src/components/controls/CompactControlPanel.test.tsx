import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Aperture, Focus, SlidersHorizontal } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import type { ControlGroup } from "../../domains/controls/grouping";
import type { UseControlPresetsResult } from "../../hooks/useControlPresets";
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
    focusMeteringPoint: null,
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

function controlPresets(overrides: Partial<UseControlPresetsResult> = {}): UseControlPresetsResult {
  return {
    presets: [],
    isLoading: false,
    error: null,
    pendingPresetId: null,
    refresh: vi.fn(),
    presetsForScope: vi.fn().mockReturnValue([]),
    savePreset: vi.fn(),
    deletePreset: vi.fn(),
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
        controlPresets={controlPresets()}
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

    render(
      <CompactControlPanel
        group={group}
        controls={controls}
        pixyHid={pixyHid()}
        controlPresets={controlPresets()}
      />
    );

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

    render(
      <CompactControlPanel
        group={group}
        controls={controls}
        pixyHid={pixyHid()}
        controlPresets={controlPresets()}
      />
    );

    expect(screen.getByText("ISO")).toBeInTheDocument();
  });

  it("shows the AE mode dependency when exposure is locked", () => {
    const group: ControlGroup = {
      id: "exposure",
      title: "Exposure Control",
      accent: "amber",
      icon: Aperture,
      controls: [
        control({
          name: "auto_exposure",
          label: "Auto Exposure",
          kind: "menu",
          value: 3,
          value_label: "Aperture Priority Mode",
          menu: [
            { value: 1, label: "Manual Mode" },
            { value: 3, label: "Aperture Priority Mode" }
          ]
        }),
        control({
          name: "exposure_time_absolute",
          label: "Exposure Time, Absolute",
          kind: "int",
          value: 300,
          min: 1,
          max: 5000,
          step: 1,
          flags: ["inactive"]
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

    render(
      <CompactControlPanel
        group={group}
        controls={controls}
        pixyHid={pixyHid()}
        controlPresets={controlPresets()}
      />
    );

    expect(screen.getByText("AE Mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto" })).toBeInTheDocument();
    expect(screen.getByText("AE Mode: Auto. Set to Manual.")).toBeInTheDocument();
  });

  it("saves active values as a named preset", async () => {
    const user = userEvent.setup();
    const savePreset = vi.fn().mockResolvedValue({
      id: "desk",
      name: "Desk",
      scope: "image",
      values: { brightness: 90 },
      created_at: "2026-06-10T00:00:00+00:00"
    });
    const group: ControlGroup = {
      id: "image",
      title: "Image Control",
      accent: "lime",
      icon: SlidersHorizontal,
      controls: [
        control({ name: "brightness", label: "Brightness", kind: "int", value: 90, min: 0, max: 255, step: 1 }),
        control({
          name: "white_balance_temperature",
          label: "WB",
          kind: "int",
          value: 5000,
          min: 2300,
          max: 7500,
          step: 1,
          flags: ["inactive"]
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

    render(
      <CompactControlPanel
        group={group}
        controls={controls}
        pixyHid={pixyHid()}
        controlPresets={controlPresets({ savePreset })}
      />
    );

    await user.type(screen.getByLabelText("Preset name"), "Desk");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(savePreset).toHaveBeenCalledWith("image", "Desk", [{ controlName: "brightness", value: 90 }]);
  });

  it("applies the selected preset through control writes", async () => {
    const user = userEvent.setup();
    const setValues = vi.fn().mockResolvedValue(undefined);
    const group: ControlGroup = {
      id: "exposure",
      title: "Exposure Control",
      accent: "amber",
      icon: Aperture,
      controls: [
        control({ name: "auto_exposure", label: "AE", kind: "menu", value: 3, menu: [] }),
        control({ name: "exposure_time_absolute", label: "Exposure", kind: "int", value: 300, min: 1, max: 5000, step: 1 }),
        control({ name: "gain", label: "Gain", kind: "int", value: 8, min: 0, max: 100, step: 1 })
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
      setValues
    };

    render(
      <CompactControlPanel
        group={group}
        controls={controls}
        pixyHid={pixyHid()}
        controlPresets={controlPresets({
          presetsForScope: vi.fn().mockReturnValue([
            {
              id: "manual",
              name: "Manual",
              scope: "exposure",
              values: { gain: 12, exposure_time_absolute: 5000, auto_exposure: 1 },
              created_at: "2026-06-10T00:00:00+00:00"
            }
          ])
        })}
      />
    );

    await user.selectOptions(screen.getByLabelText("Exposure Control preset"), "manual");
    await user.click(screen.getByLabelText("Apply preset"));

    expect(setValues).toHaveBeenCalledWith([
      { controlName: "auto_exposure", value: 1 },
      { controlName: "exposure_time_absolute", value: 5000 },
      { controlName: "gain", value: 12 }
    ]);
  });
});
