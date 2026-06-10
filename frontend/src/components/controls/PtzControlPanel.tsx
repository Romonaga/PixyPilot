import { useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronsUp,
  ChevronsDown,
  Crosshair,
  Home,
  Save
} from "lucide-react";

import type { ControlGroup } from "../../domains/controls/grouping";
import { controlValueText } from "../../domains/controls/grouping";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { PtzDirection, PtzPresetSlot, V4L2Control } from "../../types/api";
import { ControlRenderer } from "./ControlRenderer";

type Props = {
  group: ControlGroup;
  controls: UseControlsResult;
  pixyHid: UsePixyHidResult;
};

const PTZ_CONTROL_NAMES = {
  pan: "pan_absolute",
  tilt: "tilt_absolute",
  zoom: "zoom_absolute"
} as const;

type PtzPreset = {
  pan: number;
  tilt: number;
  zoom: number;
};

const SPEEDS = [1, 2, 3, 4, 5];

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

function isUsableAuxiliaryControl(control: V4L2Control): boolean {
  return control.min !== control.max;
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
      <div className="ptz-axis-header">
        <div className="ptz-axis-copy">
          <span>{label}</span>
          <small>{control.name}</small>
        </div>
        <strong>{controlValueText(control)}</strong>
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
      <div className="ptz-axis-scale">
        <span>{min}</span>
        <span>{label === "Zoom" ? "" : 0}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function PtzControlPanel({ group, controls, pixyHid }: Props) {
  const Icon = group.icon;
  const pan = findControl(group, PTZ_CONTROL_NAMES.pan);
  const tilt = findControl(group, PTZ_CONTROL_NAMES.tilt);
  const zoom = findControl(group, PTZ_CONTROL_NAMES.zoom);
  const primaryControlNames = new Set<string>(Object.values(PTZ_CONTROL_NAMES));
  const auxiliaryControls = group.controls.filter(
    (control) => !primaryControlNames.has(control.name) && isUsableAuxiliaryControl(control)
  );
  const [speed, setSpeed] = useState(3);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [presets, setPresets] = useState<(PtzPreset | null)[]>([null, null, null]);
  const hidPtzReady =
    pixyHid.status?.writable === true && pixyHid.status.known_controls.includes("ptz_direction");
  const hidPresetSaveReady =
    pixyHid.status?.writable === true && pixyHid.status.known_controls.includes("ptz_preset_save");
  const hidPresetLoadReady =
    pixyHid.status?.writable === true && pixyHid.status.known_controls.includes("ptz_preset_load");
  const hidPtzPending = pixyHid.pendingCommand?.startsWith("ptz:") ?? false;
  const hidPresetPending = pixyHid.pendingCommand?.startsWith("ptz-preset-") ?? false;

  const moveAxis = async (control: V4L2Control | undefined, direction: number, hidDirection: PtzDirection) => {
    if (hidPtzReady) {
      await pixyHid.sendPtzDirection(hidDirection);
      return;
    }
    if (!control || control.flags.includes("inactive")) {
      return;
    }
    await controls.setValue(control.name, clamp(control.value + stepFor(control) * speed * direction, control));
  };

  const centerPtz = async () => {
    const centerable = [pan, tilt].filter((control): control is V4L2Control => Boolean(control));
    for (const control of centerable) {
      if (!control.flags.includes("inactive")) {
        await controls.setValue(control.name, clamp(0, control));
      }
    }
  };

  const savePreset = async () => {
    if (!pan || !tilt || !zoom) {
      return;
    }
    if (hidPresetSaveReady) {
      await pixyHid.savePtzPreset((selectedPreset + 1) as PtzPresetSlot);
    }
    setPresets((current) =>
      current.map((preset, index) =>
        index === selectedPreset ? { pan: pan.value, tilt: tilt.value, zoom: zoom.value } : preset
      )
    );
  };

  const gotoPreset = async () => {
    const preset = presets[selectedPreset];
    if ((!preset && !hidPresetLoadReady) || controls.pendingControl !== null) {
      return;
    }
    if (hidPresetLoadReady) {
      await pixyHid.loadPtzPreset((selectedPreset + 1) as PtzPresetSlot);
      if (preset && zoom && !zoom.flags.includes("inactive")) {
        await controls.setValue(zoom.name, clamp(preset.zoom, zoom));
      }
      return;
    }
    if (!preset) {
      return;
    }
    if (pan && !pan.flags.includes("inactive")) {
      await controls.setValue(pan.name, clamp(preset.pan, pan));
    }
    if (tilt && !tilt.flags.includes("inactive")) {
      await controls.setValue(tilt.name, clamp(preset.tilt, tilt));
    }
    if (zoom && !zoom.flags.includes("inactive")) {
      await controls.setValue(zoom.name, clamp(preset.zoom, zoom));
    }
  };

  const disabled = controls.pendingControl !== null;
  const directionBlocked = (control: V4L2Control | undefined) =>
    hidPtzReady ? disabled || hidPtzPending : isBlocked(control, controls.pendingControl);

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
            disabled={directionBlocked(tilt)}
            onClick={() => void moveAxis(tilt, 1, "up")}
            title="Tilt up"
            aria-label="Tilt up"
          >
            <ChevronsUp size={22} />
          </button>
          <button
            className="ptz-direction ptz-right"
            disabled={directionBlocked(pan)}
            onClick={() => void moveAxis(pan, 1, "right")}
            title="Pan right"
            aria-label="Pan right"
          >
            <ChevronsRight size={22} />
          </button>
          <button
            className="ptz-direction ptz-down"
            disabled={directionBlocked(tilt)}
            onClick={() => void moveAxis(tilt, -1, "down")}
            title="Tilt down"
            aria-label="Tilt down"
          >
            <ChevronsDown size={22} />
          </button>
          <button
            className="ptz-direction ptz-left"
            disabled={directionBlocked(pan)}
            onClick={() => void moveAxis(pan, -1, "left")}
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

        <div className="ptz-axis-bank">
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
        </div>

        <div className="ptz-presets">
          <div className="ptz-presets-label">Presets</div>
          <div className="ptz-preset-slots">
            {presets.map((preset, index) => (
              <button
                key={index}
                className={selectedPreset === index ? "is-selected" : ""}
                onClick={() => setSelectedPreset(index)}
                aria-pressed={selectedPreset === index}
                aria-label={`Preset ${index + 1}`}
                title={preset ? `Preset ${index + 1} saved` : `Preset ${index + 1} empty`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="ptz-preset-actions">
            <button
              className="secondary-button"
              disabled={disabled || hidPresetPending || !pan || !tilt || !zoom}
              onClick={() => void savePreset()}
              aria-label="Save PTZ preset"
              title="Save PTZ preset"
            >
              <Save size={16} />
              Save
            </button>
            <button
              className="secondary-button"
              disabled={disabled || hidPresetPending || (!hidPresetLoadReady && !presets[selectedPreset])}
              onClick={() => void gotoPreset()}
              aria-label="Goto PTZ preset"
              title="Goto PTZ preset"
            >
              <Home size={16} />
              Goto
            </button>
          </div>
        </div>
      </div>

      <div className="ptz-footer">
        <div className="ptz-speed">
          <span>Speed</span>
          <div className="ptz-speed-buttons">
            {SPEEDS.map((value) => (
              <button
                key={value}
                className={speed === value ? "is-selected" : ""}
                onClick={() => setSpeed(value)}
                aria-pressed={speed === value}
                aria-label={`Speed ${value}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <button
          className="secondary-button ptz-home-button"
          disabled={disabled || (!pan && !tilt)}
          onClick={() => void centerPtz()}
          aria-label="Home PTZ"
          title="Home PTZ"
        >
          <Home size={16} />
          Home
        </button>
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
