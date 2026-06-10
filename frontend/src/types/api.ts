export type Device = {
  path: string;
  name: string;
  driver: string | null;
  bus_info: string | null;
  is_capture: boolean;
};

export type MenuOption = {
  value: number;
  label: string;
};

export type ControlKind = "int" | "bool" | "menu" | "unknown";

export type V4L2Control = {
  name: string;
  label: string;
  control_id: string;
  group: string;
  kind: ControlKind;
  value: number;
  default: number | null;
  min: number | null;
  max: number | null;
  step: number | null;
  value_label: string | null;
  flags: string[];
  menu: MenuOption[];
};

export type VideoFormatOption = {
  pixel_format: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  label: string;
};

export type VideoRecordingStatus = {
  recording: boolean;
  device_name: string | null;
  path: string | null;
  started_at: string | null;
  reason: string | null;
};

export type VideoStreamStopResult = {
  ok: boolean;
  device_name: string | null;
};

export type ControlPresetScope = "image" | "focus" | "exposure";

export type ControlPreset = {
  id: string;
  name: string;
  scope: ControlPresetScope;
  values: Record<string, number>;
  created_at: string;
};

export type ControlPresetCreateRequest = {
  name: string;
  scope: ControlPresetScope;
  values: Record<string, number>;
};

export type ControlPresetDeleteResult = {
  ok: boolean;
  id: string;
};

export type PixyHidStatus = {
  available: boolean;
  path: string | null;
  readable: boolean;
  writable: boolean;
  reason: string | null;
  known_controls: string[];
};

export type TrackingMode = "off" | "tracking" | "privacy";
export type AudioMode = "noise_cancel" | "live" | "original";
export type MirrorMode = "off" | "h" | "v" | "hv";
export type FocusMeteringMode = "center" | "human_face" | "selected_area";
export type FocusMeteringPoint = {
  x: number;
  y: number;
};
export type PtzDirection = "left" | "right" | "up" | "down";
export type PtzVector = {
  x: number;
  y: number;
  z?: number;
};
export type PtzPresetSlot = 1 | 2 | 3;

export type PixyHidCommandResult = {
  ok: boolean;
  command: string;
  value: string | number | boolean;
  path: string;
};

export type AudioStatus = {
  available: boolean;
  card: number | null;
  name: string | null;
  muted: boolean | null;
  volume: number | null;
  reason: string | null;
};

export type AudioCommandResult = {
  ok: boolean;
  command: string;
  value: boolean;
  card: number;
};

export type AppSettings = {
  safety: {
    start_in_privacy: boolean;
  };
  server: {
    host: string;
    port: number;
    reload: boolean;
    url: string;
  };
  frontend: {
    dist_path: string;
    dev_server_host: string;
    dev_server_port: number;
    single_port: boolean;
  };
  storage: {
    presets_path: string;
    recordings_dir: string;
  };
  hid: {
    path: string | null;
    report_gap_ms: number;
  };
  config: {
    path: string;
  };
};
