import type { Device, V4L2Control } from "../types/api";

const API_BASE = "";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(typeof body.detail === "string" ? body.detail : response.statusText);
  }

  return response.json() as Promise<T>;
}

export async function fetchDevices(): Promise<Device[]> {
  return requestJson<Device[]>("/api/devices");
}

export async function fetchControls(deviceName: string): Promise<V4L2Control[]> {
  return requestJson<V4L2Control[]>(`/api/devices/${encodeURIComponent(deviceName)}/controls`);
}

export async function setControlValue(
  deviceName: string,
  controlName: string,
  value: number
): Promise<V4L2Control> {
  return requestJson<V4L2Control>(
    `/api/devices/${encodeURIComponent(deviceName)}/controls/${encodeURIComponent(controlName)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ value })
    }
  );
}
