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
