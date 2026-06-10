import type { ControlGroup } from "../../domains/controls/grouping";
import type { UseControlPresetsResult } from "../../hooks/useControlPresets";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import { CompactControlPanel } from "./CompactControlPanel";
import { ControlRenderer } from "./ControlRenderer";
import { PtzControlPanel } from "./PtzControlPanel";

type Props = {
  group: ControlGroup;
  controls: UseControlsResult;
  pixyHid: UsePixyHidResult;
  controlPresets: UseControlPresetsResult;
};

export function ControlGroupPanel({ group, controls, pixyHid, controlPresets }: Props) {
  const Icon = group.icon;

  if (group.id === "ptz" && group.controls.length > 0) {
    return <PtzControlPanel group={group} controls={controls} pixyHid={pixyHid} />;
  }

  if (group.id === "image" || group.id === "focus" || group.id === "exposure") {
    return <CompactControlPanel group={group} controls={controls} pixyHid={pixyHid} controlPresets={controlPresets} />;
  }

  if (group.controls.length === 0) {
    return (
      <section className={`control-panel control-panel-${group.id} accent-${group.accent}`}>
        <div className="panel-title-row">
          <Icon size={18} />
          <h2>{group.title}</h2>
        </div>
        <div className="empty-state">Waiting on validated smart-camera commands.</div>
      </section>
    );
  }

  return (
    <section className={`control-panel control-panel-${group.id} accent-${group.accent}`}>
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
