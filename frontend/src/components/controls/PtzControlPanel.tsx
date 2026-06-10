import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
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
import { isCenteredVector, ptzVectorFromPadPoint, vectorPadPosition } from "../../domains/ptz/vectorPad";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { PtzDirection, PtzPresetSlot, PtzVector, V4L2Control } from "../../types/api";
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
const PTZ_VECTOR_SPEED_STEP = 2;
const PTZ_JOG_INITIAL_REPEAT_MS = 260;
const PTZ_JOG_REPEAT_MS_BY_SPEED: Record<number, number> = {
  1: 360,
  2: 280,
  3: 220,
  4: 160,
  5: 110
};
const PTZ_VECTOR_DRAG_THROTTLE_MS = 120;

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

function ptzVectorForDirection(direction: PtzDirection, speed: number): PtzVector {
  const magnitude = Math.min(30, Math.max(1, speed) * PTZ_VECTOR_SPEED_STEP);
  if (direction === "left") {
    return { x: -magnitude, y: 0 };
  }
  if (direction === "right") {
    return { x: magnitude, y: 0 };
  }
  if (direction === "up") {
    return { x: 0, y: magnitude };
  }
  return { x: 0, y: -magnitude };
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
  const [speed, setSpeed] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [presets, setPresets] = useState<(PtzPreset | null)[]>([null, null, null]);
  const [activeVector, setActiveVector] = useState<PtzVector | null>(null);
  const jogActiveRef = useRef(false);
  const jogTimerRef = useRef<number | null>(null);
  const vectorDragInFlightRef = useRef(false);
  const vectorDragLastSentAtRef = useRef(0);
  const vectorMotionActiveRef = useRef(false);
  const hidPtzReady =
    pixyHid.status?.writable === true && pixyHid.status.known_controls.includes("ptz_direction");
  const hidPtzVectorReady =
    pixyHid.status?.writable === true && pixyHid.status.known_controls.includes("ptz_vector");
  const hidPresetSaveReady =
    pixyHid.status?.writable === true && pixyHid.status.known_controls.includes("ptz_preset_save");
  const hidPresetLoadReady =
    pixyHid.status?.writable === true && pixyHid.status.known_controls.includes("ptz_preset_load");
  const hidPresetPending = pixyHid.pendingCommand?.startsWith("ptz-preset-") ?? false;

  const moveAxis = async (control: V4L2Control | undefined, direction: number, hidDirection: PtzDirection) => {
    if (hidPtzReady) {
      await pixyHid.sendPtzDirection(hidDirection);
      return;
    }
    if (hidPtzVectorReady) {
      const vector = ptzVectorForDirection(hidDirection, speed);
      vectorMotionActiveRef.current = true;
      setActiveVector(vector);
      await pixyHid.sendPtzVector(vector);
      return;
    }
    if (!control || control.flags.includes("inactive")) {
      return;
    }
    await controls.setValue(control.name, clamp(control.value + stepFor(control) * direction, control));
  };

  const stopPtzVector = async () => {
    if (!vectorMotionActiveRef.current || !hidPtzVectorReady) {
      setActiveVector(null);
      return;
    }
    vectorMotionActiveRef.current = false;
    setActiveVector(null);
    await pixyHid.sendPtzVector({ x: 0, y: 0, z: 0 });
  };

  const cancelJogTimers = () => {
    jogActiveRef.current = false;
    if (jogTimerRef.current !== null) {
      window.clearTimeout(jogTimerRef.current);
      jogTimerRef.current = null;
    }
  };

  const stopJog = () => {
    cancelJogTimers();
    void stopPtzVector();
  };

  useEffect(() => stopJog, []);

  const startJog = (control: V4L2Control | undefined, direction: number, hidDirection: PtzDirection) => {
    if (directionBlocked(control)) {
      return;
    }
    stopJog();
    jogActiveRef.current = true;

    const repeat = async () => {
      await moveAxis(control, direction, hidDirection);
      if (jogActiveRef.current) {
        jogTimerRef.current = window.setTimeout(() => void repeat(), PTZ_JOG_REPEAT_MS_BY_SPEED[speed] ?? 220);
      }
    };

    void moveAxis(control, direction, hidDirection).then(() => {
      if (jogActiveRef.current) {
        jogTimerRef.current = window.setTimeout(() => void repeat(), PTZ_JOG_INITIAL_REPEAT_MS);
      }
    });
  };

  const keyJog = async (
    event: KeyboardEvent<HTMLButtonElement>,
    control: V4L2Control | undefined,
    direction: number,
    hidDirection: PtzDirection
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    await moveAxis(control, direction, hidDirection);
  };

  const centerPtz = async () => {
    cancelJogTimers();
    await stopPtzVector();
    const centerable = [pan, tilt].filter((control): control is V4L2Control => Boolean(control));
    for (const control of centerable) {
      if (!control.flags.includes("inactive")) {
        await controls.setValue(control.name, clamp(0, control));
      }
    }
    if (zoom && !zoom.flags.includes("inactive")) {
      await controls.setValue(zoom.name, clamp(zoom.default ?? zoom.min ?? 0, zoom));
    }
  };

  const vectorFromPointer = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return ptzVectorFromPadPoint(
      { width: rect.width, height: rect.height },
      { x: event.clientX - rect.left, y: event.clientY - rect.top }
    );
  };

  const updateVectorPreview = (event: PointerEvent<HTMLButtonElement>) => {
    if (!hidPtzVectorReady) {
      return null;
    }
    const vector = vectorFromPointer(event);
    setActiveVector(vector);
    return vector;
  };

  const sendDragVector = async (vector: PtzVector) => {
    const now = Date.now();
    if (
      vectorDragInFlightRef.current ||
      isCenteredVector(vector) ||
      now - vectorDragLastSentAtRef.current < PTZ_VECTOR_DRAG_THROTTLE_MS
    ) {
      return;
    }
    vectorDragInFlightRef.current = true;
    vectorDragLastSentAtRef.current = now;
    vectorMotionActiveRef.current = true;
    try {
      await pixyHid.sendPtzVector(vector);
    } finally {
      vectorDragInFlightRef.current = false;
    }
  };

  const commitVectorPad = async (event: PointerEvent<HTMLButtonElement>) => {
    if (!hidPtzVectorReady) {
      await centerPtz();
      return;
    }
    const vector = vectorFromPointer(event);
    setActiveVector(vector);
    if (isCenteredVector(vector)) {
      await centerPtz();
      return;
    }
    await stopPtzVector();
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
    hidPtzVectorReady || hidPtzReady ? disabled && !jogActiveRef.current : isBlocked(control, controls.pendingControl);
  const vectorPadDisabled = disabled || (!hidPtzVectorReady && !pan && !tilt);
  const activeVectorPosition = activeVector ? vectorPadPosition(activeVector) : null;

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
            onPointerDown={() => startJog(tilt, 1, "up")}
            onPointerUp={stopJog}
            onPointerCancel={stopJog}
            onPointerLeave={stopJog}
            onKeyDown={(event) => void keyJog(event, tilt, 1, "up")}
            title="Tilt up"
            aria-label="Tilt up"
          >
            <ChevronsUp size={22} />
          </button>
          <button
            className="ptz-direction ptz-right"
            disabled={directionBlocked(pan)}
            onPointerDown={() => startJog(pan, 1, "right")}
            onPointerUp={stopJog}
            onPointerCancel={stopJog}
            onPointerLeave={stopJog}
            onKeyDown={(event) => void keyJog(event, pan, 1, "right")}
            title="Pan right"
            aria-label="Pan right"
          >
            <ChevronsRight size={22} />
          </button>
          <button
            className="ptz-direction ptz-down"
            disabled={directionBlocked(tilt)}
            onPointerDown={() => startJog(tilt, -1, "down")}
            onPointerUp={stopJog}
            onPointerCancel={stopJog}
            onPointerLeave={stopJog}
            onKeyDown={(event) => void keyJog(event, tilt, -1, "down")}
            title="Tilt down"
            aria-label="Tilt down"
          >
            <ChevronsDown size={22} />
          </button>
          <button
            className="ptz-direction ptz-left"
            disabled={directionBlocked(pan)}
            onPointerDown={() => startJog(pan, -1, "left")}
            onPointerUp={stopJog}
            onPointerCancel={stopJog}
            onPointerLeave={stopJog}
            onKeyDown={(event) => void keyJog(event, pan, -1, "left")}
            title="Pan left"
            aria-label="Pan left"
          >
            <ChevronsLeft size={22} />
          </button>
          <button
            className="ptz-center"
            disabled={vectorPadDisabled}
            onPointerDown={(event) => {
              const vector = updateVectorPreview(event);
              if (vector) {
                void sendDragVector(vector);
              }
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) {
                const vector = updateVectorPreview(event);
                if (vector) {
                  void sendDragVector(vector);
                }
              }
            }}
            onPointerCancel={() => void stopPtzVector()}
            onPointerLeave={() => void stopPtzVector()}
            onPointerUp={(event) => void commitVectorPad(event)}
            title={hidPtzVectorReady ? "Point PTZ" : "Center PTZ"}
            aria-label="Center PTZ"
          >
            <Crosshair size={24} />
            {activeVectorPosition && (
              <span
                className="ptz-vector-puck"
                style={{ left: `${activeVectorPosition.x}%`, top: `${activeVectorPosition.y}%` }}
                aria-hidden="true"
              />
            )}
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
