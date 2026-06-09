import { controlValueText } from "../../../domains/controls/grouping";
import type { V4L2Control } from "../../../types/api";

type Props = {
  control: V4L2Control;
  children: React.ReactNode;
};

export function ControlShell({ control, children }: Props) {
  const inactive = control.flags.includes("inactive");

  return (
    <div className={`control-row ${inactive ? "is-inactive" : ""}`}>
      <div className="control-copy">
        <span>{control.label}</span>
        <small>{inactive ? "Inactive while auto mode is enabled" : control.name}</small>
      </div>
      <div className="control-input-zone">{children}</div>
      <output>{controlValueText(control)}</output>
    </div>
  );
}
