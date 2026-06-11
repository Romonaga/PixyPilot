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
export type TargetTrackingMode = "off" | "face" | "half_body" | "full_body";
export type AudioMode = "noise_cancel" | "live" | "original";
export type MirrorMode = "off" | "h" | "v" | "hv";
export type FocusMeteringMode = "center" | "human_face" | "selected_area";
export type PixyHidQueryName =
  | "tracking_state"
  | "target_tracking_state"
  | "tracking_capability"
  | "tracking_probe_0100"
  | "tracking_probe_0102"
  | "tracking_probe_0103"
  | "tracking_probe_0104"
  | "device_info"
  | "audio_state"
  | "gesture_state"
  | "auto_privacy_state"
  | "focus_metering_state"
  | "mirror_horizontal_state"
  | "mirror_vertical_state"
  | "auto_rotate_state";
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

export type PixyHidRawQueryResult = {
  name: PixyHidQueryName;
  request_hex: string;
  response_hex: string | null;
  value_index: number | null;
  raw_value: number | null;
  raw_bits: number[];
  ascii_value: string | null;
  ascii_preview: string | null;
  path: string;
};

export type PixyHidDeviceState = {
  tracking_mode: TrackingMode | null;
  tracking_raw_value: number | null;
  tracking_raw_bits: number[];
  target_tracking_mode: TargetTrackingMode | null;
  target_tracking_raw_value: number | null;
  target_tracking_x: number | null;
  target_tracking_y: number | null;
  target_tracking_scale: number | null;
  audio_mode: AudioMode | null;
  audio_raw_value: number | null;
  gesture_enabled: boolean | null;
  gesture_raw_value: number | null;
  queries: Partial<Record<PixyHidQueryName, PixyHidRawQueryResult>>;
  path: string;
};

export type PixyHidDiagnosticSnapshot = {
  captured_at: string;
  path: string;
  queries: PixyHidRawQueryResult[];
  file_path: string | null;
};

export type UvcExtensionValue = {
  query: string;
  ok: boolean;
  size: number | null;
  hex_value: string | null;
  int_value: number | null;
  ascii_preview: string | null;
  error: string | null;
};

export type UvcExtensionSelectorProbe = {
  unit_id: number;
  selector: number;
  length: number | null;
  info: number | null;
  info_flags: string[];
  supports_get: boolean;
  supports_set: boolean;
  current: UvcExtensionValue | null;
  minimum: UvcExtensionValue | null;
  maximum: UvcExtensionValue | null;
  resolution: UvcExtensionValue | null;
  default: UvcExtensionValue | null;
  changed_since_previous: boolean;
  changed_fields: string[];
  errors: string[];
};

export type UvcExtensionSnapshot = {
  captured_at: string;
  device_path: string;
  unit_id: number;
  selectors: UvcExtensionSelectorProbe[];
  previous_file_path: string | null;
  changed_selectors: number[];
  file_path: string | null;
};

export type PcapImportRecord = {
  id: string;
  original_filename: string;
  stored_filename: string;
  file_path: string;
  size_bytes: number;
  sha256: string;
  uploaded_at: string;
  action: string | null;
  notes: string | null;
  source: string;
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

export type AppSettingsUpdate = {
  safety?: {
    start_in_privacy?: boolean;
  };
  server?: {
    host?: string;
    port?: number;
    reload?: boolean;
  };
  frontend?: {
    dist?: string;
    dev_server?: {
      host?: string;
      port?: number;
    };
  };
  storage?: {
    presets?: string;
    recordings?: string;
  };
  hid?: {
    path?: string | null;
    report_gap_ms?: number;
  };
};
