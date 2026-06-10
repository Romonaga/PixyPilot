import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchDevices } from "../lib/apiClient";
import type { Device } from "../types/api";

export type UseDevicesResult = {
  devices: Device[];
  selectedDeviceName: string | null;
  selectedDevice: Device | null;
  isLoading: boolean;
  error: string | null;
  setSelectedDeviceName: (deviceName: string) => void;
  refresh: (options?: { showLoading?: boolean }) => Promise<void>;
};

function deviceNameFromPath(path: string): string {
  return path.split("/").at(-1) ?? path;
}

export function useDevices(): UseDevicesResult {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async (options: { showLoading?: boolean } = {}) => {
    if (refreshInFlight.current) {
      return;
    }
    refreshInFlight.current = true;
    if (options.showLoading !== false) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const enumeratedDevices = await fetchDevices();
      const nextDevices = enumeratedDevices.filter((device) => device.is_capture);
      setDevices(nextDevices);
      setSelectedDeviceName((current) => {
        if (current && nextDevices.some((device) => deviceNameFromPath(device.path) === current)) {
          return current;
        }
        const captureDevice = nextDevices[0];
        return captureDevice ? deviceNameFromPath(captureDevice.path) : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load devices");
    } finally {
      refreshInFlight.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedDevice = useMemo(
    () =>
      devices.find((device) => deviceNameFromPath(device.path) === selectedDeviceName) ?? null,
    [devices, selectedDeviceName]
  );

  return {
    devices,
    selectedDeviceName,
    selectedDevice,
    isLoading,
    error,
    setSelectedDeviceName,
    refresh
  };
}
