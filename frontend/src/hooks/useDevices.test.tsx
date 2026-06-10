import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDevices } from "../lib/apiClient";
import { useDevices } from "./useDevices";

vi.mock("../lib/apiClient", () => ({
  fetchDevices: vi.fn()
}));

const mockedFetchDevices = vi.mocked(fetchDevices);

describe("useDevices", () => {
  beforeEach(() => {
    mockedFetchDevices.mockReset();
  });

  it("filters metadata-only devices from the controllable device list", async () => {
    mockedFetchDevices.mockResolvedValue([
      {
        path: "/dev/video0",
        name: "EMEET PIXY",
        driver: "uvcvideo",
        bus_info: "usb-test",
        is_capture: true
      },
      {
        path: "/dev/video1",
        name: "EMEET PIXY",
        driver: "uvcvideo",
        bus_info: "usb-test",
        is_capture: false
      }
    ]);

    const { result } = renderHook(() => useDevices());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.devices).toHaveLength(1);
    expect(result.current.devices[0].path).toBe("/dev/video0");
    expect(result.current.selectedDeviceName).toBe("video0");
  });

});
