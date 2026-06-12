import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { AppSettings } from "../../types/api";
import { RuntimeSettingsPanel } from "./RuntimeSettingsPanel";

function settings(): AppSettings {
  return {
    safety: { start_in_privacy: true },
    server: { host: "127.0.0.1", port: 8000, reload: false, url: "http://127.0.0.1:8000" },
    frontend: {
      dist_path: "/FastDrive/EmmetPixy/frontend/dist",
      dev_server_host: "127.0.0.1",
      dev_server_port: 5173,
      single_port: true
    },
    storage: {
      presets_path: "/FastDrive/EmmetPixy/config/presets.yaml",
      recordings_dir: "/FastDrive/EmmetPixy/recordings"
    },
    hid: { path: null, report_gap_ms: 25 },
    config: { path: "/FastDrive/EmmetPixy/config/pixypilot.yaml" }
  };
}

function privacySafety(overrides: Partial<UsePrivacySafetyResult> = {}): UsePrivacySafetyResult {
  return {
    settings: settings(),
    settingsLoaded: true,
    startupPrivacyEnabled: true,
    startupPrivacyState: "sent",
    settingsError: null,
    settingsPending: false,
    refreshSettings: vi.fn(),
    saveSettings: vi.fn().mockResolvedValue(settings()),
    enterPrivacy: vi.fn(),
    leavePrivacy: vi.fn(),
    ...overrides
  };
}

describe("RuntimeSettingsPanel", () => {
  it("edits the Vite dev server port through runtime settings", async () => {
    const user = userEvent.setup();
    const saveSettings = vi.fn().mockResolvedValue(settings());

    render(<RuntimeSettingsPanel privacySafety={privacySafety({ saveSettings })} />);

    await user.click(screen.getByRole("button", { name: "Edit Vite port" }));
    const input = screen.getByDisplayValue("5173");
    await user.clear(input);
    await user.type(input, "5174");
    await user.click(screen.getByRole("button", { name: "Save Vite port" }));

    expect(saveSettings).toHaveBeenCalledWith({ frontend: { dev_server: { port: 5174 } } });
    expect(await screen.findByText("Vite port saved")).toBeInTheDocument();
  });

  it("shows restart scope for bind and Vite settings", () => {
    render(<RuntimeSettingsPanel privacySafety={privacySafety()} />);

    expect(screen.getAllByText("dev restart").length).toBeGreaterThan(0);
    expect(screen.getAllByText("restart").length).toBeGreaterThan(0);
    expect(screen.getAllByText("live").length).toBeGreaterThan(0);
  });
});
