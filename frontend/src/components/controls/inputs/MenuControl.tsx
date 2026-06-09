import type { V4L2Control } from "../../../types/api";
import { ControlShell } from "./ControlShell";

type Props = {
  control: V4L2Control;
  disabled: boolean;
  onSetValue: (value: number) => Promise<void>;
};

export function MenuControl({ control, disabled, onSetValue }: Props) {
  const isInactive = control.flags.includes("inactive");

  return (
    <ControlShell control={control}>
      <select
        className="menu-select"
        value={control.value}
        disabled={disabled || isInactive}
        onChange={(event) => void onSetValue(Number(event.target.value))}
      >
        {control.menu.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </ControlShell>
  );
}
