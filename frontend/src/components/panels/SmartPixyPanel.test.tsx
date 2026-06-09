import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("commits auto privacy on blur instead of every keystroke", async () => {
    const user = userEvent.setup();
    const setAutoPrivacySeconds = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["auto_privacy"]
          },
          setAutoPrivacySeconds
        })}
      />
    );

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "15");

    expect(setAutoPrivacySeconds).not.toHaveBeenCalled();

    await user.tab();

    expect(setAutoPrivacySeconds).toHaveBeenCalledWith(15);
  });
});
