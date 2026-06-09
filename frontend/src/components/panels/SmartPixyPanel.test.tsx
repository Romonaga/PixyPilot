import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import { SmartPixyPanel } from "./SmartPixyPanel";

function makePixyHid(overrides: Partial<UsePixyHidResult> = {}): UsePixyHidResult {
  return {
    status: {
      available: true,
      path: "/dev/hidraw14",
      readable: false,
      writable: false,
      reason: "HID device is present but not writable by this user",
      known_controls: ["tracking"]
    },
    isLoading: false,
    pendingCommand: null,
    error: null,
    lastCommand: null,
    trackingMode: null,
    gestureEnabled: null,
    audioMode: null,
    autoPrivacySeconds: null,
    refresh: vi.fn(),
    setTrackingMode: vi.fn(),
    setGestureEnabled: vi.fn(),
    setAudioMode: vi.fn(),
    setAutoPrivacySeconds: vi.fn(),
    ...overrides
  };
}

describe("SmartPixyPanel", () => {
  it("shows permission state and disables HID controls when hidraw is not writable", () => {
    render(<SmartPixyPanel pixyHid={makePixyHid()} />);

    expect(screen.getByText("HID permission needed")).toBeInTheDocument();
    expect(screen.getByText("HID device is present but not writable by this user")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Track" })).toBeDisabled();
  });

  it("enables HID controls when hidraw is writable", () => {
    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["tracking"]
          }
        })}
      />
    );

    expect(screen.getByText("HID ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Track" })).toBeEnabled();
  });
});
