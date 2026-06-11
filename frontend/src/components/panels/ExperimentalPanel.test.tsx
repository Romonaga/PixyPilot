import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureUvcExtensionSnapshot } from "../../lib/apiClient";
import type { UvcExtensionSnapshot } from "../../types/api";
import { ExperimentalPanel } from "./ExperimentalPanel";

vi.mock("../../lib/apiClient", () => ({
  captureUvcExtensionSnapshot: vi.fn()
}));

const captureMock = vi.mocked(captureUvcExtensionSnapshot);

function snapshot(filePath: string | null = null): UvcExtensionSnapshot {
  return {
    captured_at: "2026-06-10T12:00:00+00:00",
    device_path: "/dev/video0",
    unit_id: 2,
    file_path: filePath,
    previous_file_path: "/FastDrive/EmmetPixy/diagnostics/uvc/pixypilot-uvc-video0-baseline.json",
    changed_selectors: [1],
    selectors: [
      {
        unit_id: 2,
        selector: 1,
        length: 1,
        info: 3,
        info_flags: ["GET", "SET"],
        supports_get: true,
        supports_set: true,
        current: {
          query: "current",
          ok: true,
          size: 1,
          hex_value: "01",
          int_value: 1,
          ascii_preview: null,
          error: null
        },
        minimum: null,
        maximum: null,
        resolution: null,
        default: null,
        changed_since_previous: true,
        changed_fields: ["current"],
        errors: []
      }
    ]
  };
}

describe("ExperimentalPanel", () => {
  beforeEach(() => {
    captureMock.mockReset();
  });

  it("probes UVC extension selectors for the selected device", async () => {
    const user = userEvent.setup();
    captureMock.mockResolvedValue(snapshot());

    render(<ExperimentalPanel deviceName="video0" />);

    await user.click(screen.getByRole("button", { name: /probe/i }));

    expect(captureMock).toHaveBeenCalledWith("video0", false);
    expect(await screen.findByText("Selector 1")).toBeInTheDocument();
    expect(screen.getByText(/cur:01 int:1/)).toBeInTheDocument();
    expect(screen.getByText("GET SET 1B")).toBeInTheDocument();
    expect(screen.getByText("Changed")).toBeInTheDocument();
    expect(screen.getByText("Changed selectors 1")).toBeInTheDocument();
  });

  it("saves UVC snapshots through the backend", async () => {
    const user = userEvent.setup();
    captureMock.mockResolvedValue(snapshot("/FastDrive/EmmetPixy/diagnostics/uvc/pixypilot-uvc-video0-test.json"));

    render(<ExperimentalPanel deviceName="video0" />);

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(captureMock).toHaveBeenCalledWith("video0", true);
    expect(await screen.findByText(/diagnostics\/uvc\/pixypilot-uvc-video0-test\.json/)).toBeInTheDocument();
  });
});
