import { useCallback, useEffect, useMemo, useState } from "react";

import { createControlPreset, deleteControlPreset, fetchControlPresets } from "../lib/apiClient";
import type { ControlPreset, ControlPresetScope } from "../types/api";

export type PresetValue = {
  controlName: string;
  value: number;
};

export type UseControlPresetsResult = {
  presets: ControlPreset[];
  isLoading: boolean;
  error: string | null;
  pendingPresetId: string | null;
  refresh: () => Promise<void>;
  presetsForScope: (scope: ControlPresetScope) => ControlPreset[];
  savePreset: (scope: ControlPresetScope, name: string, values: PresetValue[]) => Promise<ControlPreset | null>;
  deletePreset: (presetId: string) => Promise<void>;
};

export function useControlPresets(): UseControlPresetsResult {
  const [presets, setPresets] = useState<ControlPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPresets(await fetchControlPresets());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load presets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const presetsByScope = useMemo(() => {
    const grouped = new Map<ControlPresetScope, ControlPreset[]>();
    for (const preset of presets) {
      grouped.set(preset.scope, [...(grouped.get(preset.scope) ?? []), preset]);
    }
    return grouped;
  }, [presets]);

  const presetsForScope = useCallback(
    (scope: ControlPresetScope) => presetsByScope.get(scope) ?? [],
    [presetsByScope]
  );

  const savePreset = useCallback(async (scope: ControlPresetScope, name: string, values: PresetValue[]) => {
    const valueMap = Object.fromEntries(values.map((item) => [item.controlName, item.value]));
    if (!name.trim() || values.length === 0) {
      return null;
    }

    setPendingPresetId("save");
    setError(null);
    try {
      const preset = await createControlPreset({ name, scope, values: valueMap });
      setPresets((current) => [...current, preset]);
      return preset;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save preset");
      return null;
    } finally {
      setPendingPresetId(null);
    }
  }, []);

  const deletePreset = useCallback(async (presetId: string) => {
    setPendingPresetId(presetId);
    setError(null);
    try {
      await deleteControlPreset(presetId);
      setPresets((current) => current.filter((preset) => preset.id !== presetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete preset");
    } finally {
      setPendingPresetId(null);
    }
  }, []);

  return {
    presets,
    isLoading,
    error,
    pendingPresetId,
    refresh,
    presetsForScope,
    savePreset,
    deletePreset
  };
}
