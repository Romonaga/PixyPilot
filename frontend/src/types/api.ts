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
};
