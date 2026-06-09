import type { V4L2Control } from "../../types/api";
import { BoolControl } from "./inputs/BoolControl";
import { MenuControl } from "./inputs/MenuControl";
import { RangeControl } from "./inputs/RangeControl";

type Props = {
  control: V4L2Control;
  disabled: boolean;
  onSetValue: (value: number) => Promise<void>;
};

export function ControlRenderer({ control, disabled, onSetValue }: Props) {
  if (control.kind === "bool") {
    return <BoolControl control={control} disabled={disabled} onSetValue={onSetValue} />;
  }

  if (control.kind === "menu") {
    return <MenuControl control={control} disabled={disabled} onSetValue={onSetValue} />;
  }

  return <RangeControl control={control} disabled={disabled} onSetValue={onSetValue} />;
}
