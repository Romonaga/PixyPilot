import type { ControlGroup } from "../../domains/controls/grouping";
import type { UseControlsResult } from "../../hooks/useControls";
import { ControlRenderer } from "./ControlRenderer";
import { PtzControlPanel } from "./PtzControlPanel";

type Props = {
  group: ControlGroup;
  controls: UseControlsResult;
};

export function ControlGroupPanel({ group, controls }: Props) {
  const Icon = group.icon;

  if (group.id === "ptz" && group.controls.length > 0) {
    return <PtzControlPanel group={group} controls={controls} />;
  }

  if (group.controls.length === 0) {
    return (
      <section className={`control-panel accent-${group.accent}`}>
        <div className="panel-title-row">
          <Icon size={18} />
          <h2>{group.title}</h2>
        </div>
        <div className="empty-state">Waiting on validated smart-camera commands.</div>
      </section>
    );
  }

  return (
    <section className={`control-panel accent-${group.accent}`}>
      <div className="panel-title-row">
        <Icon size={18} />
        <h2>{group.title}</h2>
      </div>
      <div className="control-stack">
        {group.controls.map((control) => (
          <ControlRenderer
            key={control.name}
            control={control}
            disabled={controls.pendingControl === control.name}
            onSetValue={(value) => controls.setValue(control.name, value)}
          />
        ))}
      </div>
    </section>
  );
}
