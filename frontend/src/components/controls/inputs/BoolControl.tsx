import type { V4L2Control } from "../../../types/api";
import { ControlShell } from "./ControlShell";

type Props = {
  control: V4L2Control;
  disabled: boolean;
  onSetValue: (value: number) => Promise<void>;
};

export function BoolControl({ control, disabled, onSetValue }: Props) {
  const isInactive = control.flags.includes("inactive");
  const checked = control.value === 1;

  return (
    <ControlShell control={control}>
      <button
        className={`toggle-switch ${checked ? "is-on" : ""}`}
        disabled={disabled || isInactive}
        onClick={() => void onSetValue(checked ? 0 : 1)}
        aria-pressed={checked}
      >
        <span />
      </button>
    </ControlShell>
  );
}
