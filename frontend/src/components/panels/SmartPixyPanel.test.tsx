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
    deviceTrackingState: "unknown",
    deviceTrackingRawValue: null,
    deviceTrackingRawBits: [],
    targetTrackingMode: null,
    targetTrackingRawValue: null,
    gestureEnabled: null,
    autoRotateEnabled: null,
    mirrorMode: null,
    focusMeteringMode: null,
    focusMeteringPoint: null,
    audioMode: null,
    autoPrivacySeconds: null,
    refresh: vi.fn(),
    refreshStatus: vi.fn(),
    setTrackingMode: vi.fn(),
    setTargetTrackingMode: vi.fn(),
    setGestureEnabled: vi.fn(),
    setAutoRotateEnabled: vi.fn(),
    setMirrorMode: vi.fn(),
    setFocusMeteringMode: vi.fn(),
    setAudioMode: vi.fn(),
    setAutoPrivacySeconds: vi.fn(),
    sendPtzDirection: vi.fn(),
    sendPtzRelative: vi.fn(),
    sendPtzAbsolute: vi.fn(),
    sendPtzVector: vi.fn(),
    recenterPtz: vi.fn(),
    savePtzPreset: vi.fn(),
    loadPtzPreset: vi.fn(),
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
    settings: null,
    settingsLoaded: true,
    startupPrivacyEnabled: true,
    startupPrivacyState: "sent",
    settingsError: null,
    settingsPending: false,
    refreshSettings: vi.fn(),
    saveSettings: vi.fn(),
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
    expect(screen.getByRole("button", { name: "Standard" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tracking" })).toBeDisabled();
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
    expect(screen.getByRole("button", { name: "Standard" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tracking" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Privacy" })).toBeEnabled();
    expect(screen.queryByText("Speaker Tracking")).not.toBeInTheDocument();
    expect(screen.queryByText("Capture needed")).not.toBeInTheDocument();
    expect(screen.getByText("Startup privacy sent; mic mute requested")).toBeInTheDocument();
  });

  it("does not claim privacy is active when the refreshed HID state is unknown", () => {
    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["tracking", "privacy"]
          },
          trackingMode: null
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    expect(screen.getByText("Device mode is unknown after refresh. Select Privacy to send privacy mode now.")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Privacy" })).not.toHaveClass("is-selected");
  });

  it("shows non-privacy readback separately from the last commanded mode", () => {
    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["tracking", "privacy"]
          },
          trackingMode: "tracking",
          deviceTrackingState: "non_privacy",
          deviceTrackingRawValue: 3,
          deviceTrackingRawBits: [0, 1]
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    expect(screen.getByText("Non-privacy raw 3 bits 0,1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tracking" })).toHaveClass("is-selected");
  });

  it("keeps experimental target-tracking modes out of the main control panel", () => {
    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["tracking", "target_tracking"]
          },
          trackingMode: "tracking",
          deviceTrackingState: "tracking",
          deviceTrackingRawValue: 1,
          deviceTrackingRawBits: [0],
          targetTrackingMode: "face",
          targetTrackingRawValue: 1
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    expect(screen.getByText("Tracking raw 1 bits 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tracking" })).toHaveClass("is-selected");
    expect(screen.getByText("Tracking mode is active. Focus target selection is handled in Focus Control: Center, Face, or Region.")).toBeInTheDocument();
    expect(screen.queryByText("Tracking Target")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Face" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Half" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Full" })).not.toBeInTheDocument();
  });

  it("describes focus targeting separately while standard mode is selected", () => {
    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["tracking", "target_tracking"]
          },
          trackingMode: "off",
          deviceTrackingState: "standard",
          deviceTrackingRawValue: 0,
          targetTrackingMode: "off",
          targetTrackingRawValue: 0
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    expect(screen.getByText("Standard raw 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Standard" })).toHaveClass("is-selected");
    expect(screen.getByText("Device reports Standard mode. Select Tracking for auto follow, or use Focus Control for Center, Face, or Region metering.")).toBeInTheDocument();
    expect(screen.queryByText("Tracking Target")).not.toBeInTheDocument();
  });

  it("selects the proven tracking control mode", async () => {
    const user = userEvent.setup();
    const setTrackingMode = vi.fn().mockResolvedValue(undefined);

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
          },
          setTrackingMode
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Tracking" }));

    expect(setTrackingMode).toHaveBeenCalledWith("tracking");
  });

  it("does not force target Face when Tracking mode is selected", async () => {
    const user = userEvent.setup();
    const setTrackingMode = vi.fn().mockResolvedValue(undefined);
    const setTargetTrackingMode = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["tracking", "target_tracking"]
          },
          setTrackingMode,
          setTargetTrackingMode
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Tracking" }));

    expect(setTrackingMode).toHaveBeenCalledWith("tracking");
    expect(setTargetTrackingMode).not.toHaveBeenCalled();
  });

  it("shows privacy as the selected control mode after PixyPilot sends it", () => {
    const setTrackingMode = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["tracking", "privacy"]
          },
          trackingMode: "privacy",
          setTrackingMode
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    expect(screen.getByRole("button", { name: "Privacy" })).toHaveClass("is-selected");
    expect(setTrackingMode).not.toHaveBeenCalled();
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

  it("sends standard mode when privacy mode is cleared", async () => {
    const user = userEvent.setup();
    const setTrackingMode = vi.fn().mockResolvedValue(undefined);
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
          setTrackingMode
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety({ leavePrivacy })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Standard" }));

    expect(setTrackingMode).toHaveBeenCalledWith("off");
    expect(leavePrivacy).not.toHaveBeenCalled();
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

  it("offers captured auto privacy presets", async () => {
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

    await user.click(screen.getByRole("button", { name: "15m" }));

    expect(setAutoPrivacySeconds).toHaveBeenCalledWith(900);
    expect(screen.getByRole("spinbutton")).toHaveValue(900);
  });

  it("marks auto privacy as experimental until the trigger condition is confirmed", () => {
    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["privacy", "auto_privacy"]
          },
          trackingMode: "off"
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    expect(screen.getByText("Device mode is unknown after refresh. Select Privacy to send privacy mode now.")).toBeInTheDocument();
  });

  it("toggles the known gesture command", async () => {
    const user = userEvent.setup();
    const setGestureEnabled = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["gesture"]
          },
          setGestureEnabled
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Gesture Control" }));

    expect(setGestureEnabled).toHaveBeenCalledWith(true);
  });

  it("toggles the captured auto rotate command", async () => {
    const user = userEvent.setup();
    const setAutoRotateEnabled = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["auto_rotate"]
          },
          setAutoRotateEnabled
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Auto Rotate" }));

    expect(setAutoRotateEnabled).toHaveBeenCalledWith(true);
  });

  it("selects known audio DSP modes", async () => {
    const user = userEvent.setup();
    const setAudioMode = vi.fn().mockResolvedValue(undefined);

    render(
      <SmartPixyPanel
        pixyHid={makePixyHid({
          status: {
            available: true,
            path: "/dev/hidraw14",
            readable: true,
            writable: true,
            reason: null,
            known_controls: ["audio_mode"]
          },
          setAudioMode
        })}
        audio={makeAudio()}
        privacySafety={makePrivacySafety()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Original" }));

    expect(setAudioMode).toHaveBeenCalledWith("original");
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
