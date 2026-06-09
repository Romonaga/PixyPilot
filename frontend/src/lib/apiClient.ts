import type {
  AudioCommandResult,
  AudioStatus,
  AudioMode,
  AppSettings,
  Device,
  PixyHidCommandResult,
  PixyHidStatus,
  TrackingMode,
  V4L2Control
} from "../types/api";

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

export async function fetchSettings(): Promise<AppSettings> {
  return requestJson<AppSettings>("/api/settings");
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

export async function fetchPixyHidStatus(): Promise<PixyHidStatus> {
  return requestJson<PixyHidStatus>("/api/pixy-hid/status");
}

export async function setPixyTracking(mode: TrackingMode): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/tracking", {
    method: "PATCH",
    body: JSON.stringify({ mode })
  });
}

export async function setPixyGesture(enabled: boolean): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/gesture", {
    method: "PATCH",
    body: JSON.stringify({ enabled })
  });
}

export async function setPixyAudio(mode: AudioMode): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/audio", {
    method: "PATCH",
    body: JSON.stringify({ mode })
  });
}

export async function setPixyAutoPrivacy(timeoutSeconds: number): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/auto-privacy", {
    method: "PATCH",
    body: JSON.stringify({ timeout_seconds: timeoutSeconds })
  });
}

export async function fetchAudioStatus(): Promise<AudioStatus> {
  return requestJson<AudioStatus>("/api/audio/status");
}

export async function setAudioMute(muted: boolean): Promise<AudioCommandResult> {
  return requestJson<AudioCommandResult>("/api/audio/mute", {
    method: "PATCH",
    body: JSON.stringify({ muted })
  });
}
