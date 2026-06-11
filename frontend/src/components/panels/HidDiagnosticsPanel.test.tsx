import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { capturePixyHidDiagnostics } from "../../lib/apiClient";
import type { PixyHidDiagnosticSnapshot } from "../../types/api";
import { HidDiagnosticsPanel } from "./HidDiagnosticsPanel";

vi.mock("../../lib/apiClient", () => ({
  capturePixyHidDiagnostics: vi.fn()
}));

const captureMock = vi.mocked(capturePixyHidDiagnostics);

function snapshot(filePath: string | null = null): PixyHidDiagnosticSnapshot {
  return {
    captured_at: "2026-06-10T12:00:00+00:00",
    path: "/dev/hidraw14",
    file_path: filePath,
    queries: [
      {
        name: "tracking_state",
        request_hex: "09 01 01 01",
        response_hex: "09 01 01 01 00 01 00 01 03",
        value_index: 8,
        raw_value: 3,
        raw_bits: [0, 1],
        ascii_value: null,
        ascii_preview: "........",
        path: "/dev/hidraw14"
      }
    ]
  };
}

describe("HidDiagnosticsPanel", () => {
  beforeEach(() => {
    captureMock.mockReset();
  });

  it("captures and displays raw HID bit data", async () => {
    const user = userEvent.setup();
    captureMock.mockResolvedValue(snapshot());

    render(<HidDiagnosticsPanel />);

    await user.click(screen.getByRole("button", { name: /capture/i }));

    expect(captureMock).toHaveBeenCalledWith(false);
    expect(await screen.findByText("tracking state")).toBeInTheDocument();
    expect(screen.getByText("0x03")).toBeInTheDocument();
    expect(screen.getByText("bits 0,1")).toBeInTheDocument();
    expect(screen.getByText(/ASCII/)).toHaveTextContent("ASCII ........");
  });

  it("saves a diagnostic snapshot through the backend", async () => {
    const user = userEvent.setup();
    captureMock.mockResolvedValue(snapshot("/FastDrive/EmmetPixy/diagnostics/hid/pixypilot-hid-test.json"));

    render(<HidDiagnosticsPanel />);

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(captureMock).toHaveBeenCalledWith(true);
    expect(await screen.findByText(/diagnostics\/hid\/pixypilot-hid-test\.json/)).toBeInTheDocument();
  });
});
