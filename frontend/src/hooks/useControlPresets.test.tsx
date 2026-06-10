import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createControlPreset, deleteControlPreset, fetchControlPresets } from "../lib/apiClient";
import { useControlPresets } from "./useControlPresets";

vi.mock("../lib/apiClient", () => ({
  fetchControlPresets: vi.fn(),
  createControlPreset: vi.fn(),
  deleteControlPreset: vi.fn()
}));

const mockedFetchControlPresets = vi.mocked(fetchControlPresets);
const mockedCreateControlPreset = vi.mocked(createControlPreset);
const mockedDeleteControlPreset = vi.mocked(deleteControlPreset);

describe("useControlPresets", () => {
  beforeEach(() => {
    mockedFetchControlPresets.mockReset();
    mockedCreateControlPreset.mockReset();
    mockedDeleteControlPreset.mockReset();
  });

  it("loads presets and groups them by scope", async () => {
    mockedFetchControlPresets.mockResolvedValue([
      {
        id: "image-1",
        name: "Desk",
        scope: "image",
        values: { brightness: 128 },
        created_at: "2026-06-10T00:00:00+00:00"
      },
      {
        id: "focus-1",
        name: "Near",
        scope: "focus",
        values: { focus_absolute: 512 },
        created_at: "2026-06-10T00:00:01+00:00"
      }
    ]);

    const { result } = renderHook(() => useControlPresets());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.presetsForScope("image")).toHaveLength(1);
    expect(result.current.presetsForScope("focus")).toHaveLength(1);
    expect(result.current.presetsForScope("exposure")).toHaveLength(0);
  });

  it("saves and deletes presets through the API", async () => {
    mockedFetchControlPresets.mockResolvedValue([]);
    mockedCreateControlPreset.mockResolvedValue({
      id: "image-1",
      name: "Desk",
      scope: "image",
      values: { brightness: 128 },
      created_at: "2026-06-10T00:00:00+00:00"
    });
    mockedDeleteControlPreset.mockResolvedValue({ ok: true, id: "image-1" });

    const { result } = renderHook(() => useControlPresets());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.savePreset("image", "Desk", [{ controlName: "brightness", value: 128 }]);
    });

    expect(mockedCreateControlPreset).toHaveBeenCalledWith({
      name: "Desk",
      scope: "image",
      values: { brightness: 128 }
    });
    expect(result.current.presets).toHaveLength(1);

    await act(async () => {
      await result.current.deletePreset("image-1");
    });

    expect(mockedDeleteControlPreset).toHaveBeenCalledWith("image-1");
    expect(result.current.presets).toHaveLength(0);
  });
});
