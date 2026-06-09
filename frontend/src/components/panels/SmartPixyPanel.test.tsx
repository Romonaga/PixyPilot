import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { UseAudioResult } from "../../hooks/useAudio";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
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

function makeAudio(overrides: Partial<UseAudioResult> = {}): UseAudioResult {
  return {
    status: {
      available: true,
      card: 3,
      name: "EMEET PIXY",
      muted: false,
      volume: 10,
      reason: null
    },
    isLoading: false,
    pending: false,
    error: null,
    refresh: vi.fn(),
    setMuted: vi.fn(),
    ...overrides
  };
}

function makePrivacySafety(overrides: Partial<UsePrivacySafetyResult> = {}): UsePrivacySafetyResult {
  return {
    enterPrivacy: vi.fn().mockResolvedValue(undefined),
    leavePrivacy: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("SmartPixyPanel", () => {
  it("shows permission state and disables HID controls when hidraw is not writable", () => {
    render(<SmartPixyPanel pixyHid={makePixyHid()} audio={makeAudio()} privacySafety={makePrivacySafety()} />);

    expect(screen.getByText("HID permission needed")).toBeInTheDocument();
    expect(screen.getByText("HID device is present but not writable by this user")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto Framing" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Privacy" })).toBeDisabled();
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
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    expect(screen.getByText("HID ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto Framing" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Privacy" })).toBeEnabled();
    expect(screen.getByText("Speaker Tracking")).toBeInTheDocument();
    expect(screen.getByText("Capture needed")).toBeInTheDocument();
  });

  it("enters privacy safety mode when privacy is pressed", async () => {
    const user = userEvent.setup();
    const enterPrivacy = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["privacy"]
          },
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety({ enterPrivacy })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Privacy" }));

    expect(enterPrivacy).toHaveBeenCalledTimes(1);
  });

  it("resends privacy when privacy mode is already selected", async () => {
    const user = userEvent.setup();
    const enterPrivacy = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["privacy"]
          },
          trackingMode: "privacy",
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety({ enterPrivacy })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Privacy" }));

    expect(enterPrivacy).toHaveBeenCalledTimes(1);
  });

  it("sends idle when privacy mode is cleared", async () => {
    const user = userEvent.setup();
    const leavePrivacy = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["privacy"]
          },
          trackingMode: "privacy",
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety({ leavePrivacy })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Off" }));

    expect(leavePrivacy).toHaveBeenCalledTimes(1);
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
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "15");

    expect(setAutoPrivacySeconds).not.toHaveBeenCalled();

    await user.tab();

    expect(setAutoPrivacySeconds).toHaveBeenCalledWith(15);
  });

  it("toggles standard mic mute through the audio hook", async () => {
    const user = userEvent.setup();
    const setMuted = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid()}
        audio={makeAudio({ setMuted })}
        privacySafety={makePrivacySafety()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Mic mute" }));

    expect(setMuted).toHaveBeenCalledWith(true);
  });
});
