import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, ChevronsUp, ChevronsDown, Crosshair, ZoomIn, ZoomOut } from "lucide-react";

import type { ControlGroup } from "../../domains/controls/grouping";
import { controlValueText } from "../../domains/controls/grouping";
import type { UseControlsResult } from "../../hooks/useControls";
import type { V4L2Control } from "../../types/api";
import { ControlRenderer } from "./ControlRenderer";

type Props = {
  group: ControlGroup;
  controls: UseControlsResult;
};

const PTZ_CONTROL_NAMES = {
  pan: "pan_absolute",
  tilt: "tilt_absolute",
  zoom: "zoom_absolute"
} as const;

function findControl(group: ControlGroup, name: string): V4L2Control | undefined {
  return group.controls.find((control) => control.name === name);
}

function clamp(value: number, control: V4L2Control): number {
  const min = control.min ?? value;
  const max = control.max ?? value;
  return Math.min(max, Math.max(min, value));
}

function stepFor(control: V4L2Control | undefined): number {
  if (!control) {
    return 1;
  }
  return control.step && control.step > 0 ? control.step : 1;
}

function isBlocked(control: V4L2Control | undefined, pendingControl: string | null): boolean {
  return !control || control.flags.includes("inactive") || pendingControl !== null;
}

type AxisControlProps = {
  label: string;
  control: V4L2Control | undefined;
  disabled: boolean;
  onSetValue: (value: number) => Promise<void>;
};

function AxisControl({ label, control, disabled, onSetValue }: AxisControlProps) {
  const [draftValue, setDraftValue] = useState(control?.value ?? 0);

  useEffect(() => {
    setDraftValue(control?.value ?? 0);
  }, [control?.value]);

  if (!control) {
    return (
      <div className="ptz-axis is-missing">
        <div className="ptz-axis-copy">
          <span>{label}</span>
          <small>Not exposed</small>
        </div>
        <strong>Missing</strong>
      </div>
    );
  }

  const min = control.min ?? 0;
  const max = control.max ?? 100;
  const step = stepFor(control);
  const inactive = control.flags.includes("inactive");

  return (
    <div className={`ptz-axis ${inactive ? "is-inactive" : ""}`}>
      <div className="ptz-axis-copy">
        <span>{label}</span>
        <small>{control.name}</small>
      </div>
      <input
        className="range-input ptz-axis-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={draftValue}
        disabled={disabled || inactive}
        onChange={(event) => setDraftValue(Number(event.target.value))}
        onBlur={() => void onSetValue(draftValue)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void onSetValue(draftValue);
          }
        }}
      />
      <strong>{controlValueText(control)}</strong>
    </div>
  );
}

export function PtzControlPanel({ group, controls }: Props) {
  const Icon = group.icon;
  const pan = findControl(group, PTZ_CONTROL_NAMES.pan);
  const tilt = findControl(group, PTZ_CONTROL_NAMES.tilt);
  const zoom = findControl(group, PTZ_CONTROL_NAMES.zoom);
  const primaryControlNames = new Set<string>(Object.values(PTZ_CONTROL_NAMES));
  const auxiliaryControls = group.controls.filter((control) => !primaryControlNames.has(control.name));

  const moveAxis = async (control: V4L2Control | undefined, direction: number) => {
    if (!control || control.flags.includes("inactive")) {
      return;
    }
    await controls.setValue(control.name, clamp(control.value + stepFor(control) * direction, control));
  };

  const centerPtz = async () => {
    const centerable = [pan, tilt].filter((control): control is V4L2Control => Boolean(control));
    for (const control of centerable) {
      if (!control.flags.includes("inactive")) {
        await controls.setValue(control.name, clamp(0, control));
      }
    }
  };

  const disabled = controls.pendingControl !== null;

  return (
    <section className={`control-panel ptz-panel accent-${group.accent}`}>
      <div className="panel-title-row">
        <Icon size={18} />
        <h2>{group.title}</h2>
      </div>

      <div className="ptz-deck">
        <div className="ptz-pad" aria-label="Pan and tilt controls">
          <button
            className="ptz-direction ptz-up"
            disabled={isBlocked(tilt, controls.pendingControl)}
            onClick={() => void moveAxis(tilt, 1)}
            title="Tilt up"
            aria-label="Tilt up"
          >
            <ChevronsUp size={22} />
          </button>
          <button
            className="ptz-direction ptz-right"
            disabled={isBlocked(pan, controls.pendingControl)}
            onClick={() => void moveAxis(pan, 1)}
            title="Pan right"
            aria-label="Pan right"
          >
            <ChevronsRight size={22} />
          </button>
          <button
            className="ptz-direction ptz-down"
            disabled={isBlocked(tilt, controls.pendingControl)}
            onClick={() => void moveAxis(tilt, -1)}
            title="Tilt down"
            aria-label="Tilt down"
          >
            <ChevronsDown size={22} />
          </button>
          <button
            className="ptz-direction ptz-left"
            disabled={isBlocked(pan, controls.pendingControl)}
            onClick={() => void moveAxis(pan, -1)}
            title="Pan left"
            aria-label="Pan left"
          >
            <ChevronsLeft size={22} />
          </button>
          <button
            className="ptz-center"
            disabled={disabled || (!pan && !tilt)}
            onClick={() => void centerPtz()}
            title="Center PTZ"
            aria-label="Center PTZ"
          >
            <Crosshair size={24} />
          </button>
        </div>

        <div className="ptz-sidecar">
          <div className="ptz-readouts">
            <AxisControl
              label="Pan"
              control={pan}
              disabled={controls.pendingControl === pan?.name}
              onSetValue={(value) => controls.setValue(PTZ_CONTROL_NAMES.pan, value)}
            />
            <AxisControl
              label="Tilt"
              control={tilt}
              disabled={controls.pendingControl === tilt?.name}
              onSetValue={(value) => controls.setValue(PTZ_CONTROL_NAMES.tilt, value)}
            />
            <AxisControl
              label="Zoom"
              control={zoom}
              disabled={controls.pendingControl === zoom?.name}
              onSetValue={(value) => controls.setValue(PTZ_CONTROL_NAMES.zoom, value)}
            />
          </div>
          <div className="ptz-actions">
            <button
              className="secondary-button ptz-zoom-button"
              disabled={isBlocked(zoom, controls.pendingControl)}
              onClick={() => void moveAxis(zoom, -1)}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut size={17} />
              Out
            </button>
            <button
              className="secondary-button ptz-zoom-button"
              disabled={isBlocked(zoom, controls.pendingControl)}
              onClick={() => void moveAxis(zoom, 1)}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn size={17} />
              In
            </button>
          </div>
        </div>
      </div>

      {auxiliaryControls.length > 0 && (
        <div className="control-stack ptz-raw-controls">
          {auxiliaryControls.map((control) => (
            <ControlRenderer
              key={control.name}
              control={control}
              disabled={controls.pendingControl === control.name}
              onSetValue={(value) => controls.setValue(control.name, value)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
