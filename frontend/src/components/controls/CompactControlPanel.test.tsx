import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Focus } from "lucide-react";
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
});
