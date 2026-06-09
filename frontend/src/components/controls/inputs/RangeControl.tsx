import { useEffect, useState } from "react";

import type { V4L2Control } from "../../../types/api";
import { ControlShell } from "./ControlShell";

type Props = {
  control: V4L2Control;
  disabled: boolean;
  onSetValue: (value: number) => Promise<void>;
};

export function RangeControl({ control, disabled, onSetValue }: Props) {
  const [draftValue, setDraftValue] = useState(control.value);
  const isInactive = control.flags.includes("inactive");
  const min = control.min ?? 0;
  const max = control.max ?? 100;
  const step = control.step && control.step > 0 ? control.step : 1;

  useEffect(() => {
    setDraftValue(control.value);
  }, [control.value]);

  return (
    <ControlShell control={control}>
      <input
        className="range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={draftValue}
        disabled={disabled || isInactive}
        onChange={(event) => setDraftValue(Number(event.target.value))}
        onBlur={() => void onSetValue(draftValue)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void onSetValue(draftValue);
          }
        }}
      />
    </ControlShell>
  );
}
