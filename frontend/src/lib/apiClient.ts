import type {
  AudioCommandResult,
  AudioStatus,
  AudioMode,
  AppSettings,
  ControlPreset,
  ControlPresetCreateRequest,
  ControlPresetDeleteResult,
  Device,
  FocusMeteringMode,
  MirrorMode,
  PixyHidCommandResult,
  PixyHidStatus,
  PtzDirection,
  PtzPresetSlot,
  PtzVector,
  TrackingMode,
  V4L2Control,
  VideoFormatOption,
  VideoRecordingStatus
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

export async function fetchControlPresets(): Promise<ControlPreset[]> {
  return requestJson<ControlPreset[]>("/api/control-presets");
}

export async function createControlPreset(request: ControlPresetCreateRequest): Promise<ControlPreset> {
  return requestJson<ControlPreset>("/api/control-presets", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export async function deleteControlPreset(presetId: string): Promise<ControlPresetDeleteResult> {
  return requestJson<ControlPresetDeleteResult>(`/api/control-presets/${encodeURIComponent(presetId)}`, {
    method: "DELETE"
  });
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

export async function fetchVideoFormats(deviceName: string): Promise<VideoFormatOption[]> {
  return requestJson<VideoFormatOption[]>(`/api/devices/${encodeURIComponent(deviceName)}/formats`);
}

export async function setVideoFormat(
  deviceName: string,
  format: Pick<VideoFormatOption, "pixel_format" | "width" | "height" | "fps">
): Promise<VideoFormatOption> {
  return requestJson<VideoFormatOption>(`/api/devices/${encodeURIComponent(deviceName)}/format`, {
    method: "PATCH",
    body: JSON.stringify(format)
  });
}

export function videoStreamUrl(
  deviceName: string,
  format: Pick<VideoFormatOption, "pixel_format" | "width" | "height" | "fps">
): string {
  const params = new URLSearchParams({
    pixel_format: format.pixel_format,
    width: String(format.width),
    height: String(format.height),
    fps: String(format.fps),
    t: String(Date.now())
  });
  return `${API_BASE}/api/devices/${encodeURIComponent(deviceName)}/stream?${params.toString()}`;
}

export async function fetchVideoRecordingStatus(): Promise<VideoRecordingStatus> {
  return requestJson<VideoRecordingStatus>("/api/video/recording/status");
}

export async function startVideoRecording(
  deviceName: string,
  format: Pick<VideoFormatOption, "pixel_format" | "width" | "height" | "fps">
): Promise<VideoRecordingStatus> {
  return requestJson<VideoRecordingStatus>(`/api/devices/${encodeURIComponent(deviceName)}/recording/start`, {
    method: "POST",
    body: JSON.stringify(format)
  });
}

export async function stopVideoRecording(): Promise<VideoRecordingStatus> {
  return requestJson<VideoRecordingStatus>("/api/video/recording/stop", {
    method: "POST"
  });
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

export async function setPixyAutoRotate(enabled: boolean): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/auto-rotate", {
    method: "PATCH",
    body: JSON.stringify({ enabled })
  });
}

export async function setPixyMirror(mode: MirrorMode): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/mirror", {
    method: "PATCH",
    body: JSON.stringify({
      horizontal: mode === "h" || mode === "hv",
      vertical: mode === "v" || mode === "hv"
    })
  });
}

export async function setPixyFocusMetering(mode: FocusMeteringMode): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/focus-metering", {
    method: "PATCH",
    body: JSON.stringify({ mode })
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

export async function sendPixyPtzDirection(direction: PtzDirection): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/ptz-direction", {
    method: "PATCH",
    body: JSON.stringify({ direction })
  });
}

export async function sendPixyPtzVector(vector: PtzVector): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/ptz-vector", {
    method: "PATCH",
    body: JSON.stringify({ z: 0, ...vector })
  });
}

export async function savePixyPtzPreset(slot: PtzPresetSlot): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/ptz-preset/save", {
    method: "PATCH",
    body: JSON.stringify({ slot })
  });
}

export async function loadPixyPtzPreset(slot: PtzPresetSlot): Promise<PixyHidCommandResult> {
  return requestJson<PixyHidCommandResult>("/api/pixy-hid/ptz-preset/load", {
    method: "PATCH",
    body: JSON.stringify({ slot })
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
