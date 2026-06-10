import { Aperture, Camera, Cpu, Crosshair, Focus, RotateCw, SlidersHorizontal, Sparkles } from "lucide-react";

import type { UseControlsResult } from "../../hooks/useControls";
import type { UseDevicesResult } from "../../hooks/useDevices";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import { formatKey, type UseVideoFormatsResult } from "../../hooks/useVideoFormats";

function deviceNameFromPath(path: string): string {
  return path.split("/").at(-1) ?? path;
}

type Props = {
  devices: UseDevicesResult;
  controls: UseControlsResult;
  videoFormats: UseVideoFormatsResult;
  pixyHid: UsePixyHidResult;
};

function hasAnyControl(controls: UseControlsResult, names: string[]): boolean {
  return controls.controls.some((control) => names.includes(control.name));
}

export function DeviceRail({ devices, controls, videoFormats, pixyHid }: Props) {
  const selectedDeviceName = devices.selectedDeviceName ?? "";
  const selectedDevice = devices.selectedDevice;
  const capabilityRows = [
    {
      label: "PTZ Control",
      detail: "Pan, Tilt, Zoom",
      ready: hasAnyControl(controls, ["pan_absolute", "tilt_absolute", "zoom_absolute"]),
      icon: Crosshair
    },
    {
      label: "Image Control",
      detail: "WB, Color, NR",
      ready: hasAnyControl(controls, ["brightness", "contrast", "saturation", "sharpness"]),
      icon: SlidersHorizontal
    },
    {
      label: "Focus Control",
      detail: "Auto, Manual",
      ready: hasAnyControl(controls, ["focus_absolute", "focus_automatic_continuous"]),
      icon: Focus
    },
    {
      label: "Exposure Control",
      detail: "Auto, Manual",
      ready: hasAnyControl(controls, ["auto_exposure", "exposure_time_absolute"]),
      icon: Aperture
    },
    {
      label: "Smart Pixy",
      detail: "Framing, Gesture",
      ready: pixyHid.status?.writable === true,
      icon: Sparkles,
      partial: pixyHid.status?.available === true && pixyHid.status?.writable !== true
    }
  ];

  return (
    <aside className="device-rail">
      <div className="panel-title-row">
        <Camera size={18} />
        <h2>Device Bay</h2>
      </div>

      <div className="device-picker">
        <div className="device-picker-readout">
          <Camera size={24} />
          <div>
            <strong>{selectedDevice?.name ?? "No camera selected"}</strong>
            <small>
              {selectedDeviceName ? `/${selectedDeviceName}` : "Awaiting PIXY"}
              {selectedDevice ? " - Capture" : ""}
            </small>
          </div>
        </div>
        <select
          className="device-select"
          aria-label="Select video device"
          value={selectedDeviceName}
          disabled={devices.devices.length === 0}
          onChange={(event) => devices.setSelectedDeviceName(event.target.value)}
        >
          {devices.devices.length === 0 && <option value="">No devices</option>}
          {devices.devices.map((device) => {
            const deviceName = deviceNameFromPath(device.path);
            return (
              <option key={device.path} value={deviceName}>
                {deviceName.toUpperCase()} - Capture
              </option>
            );
          })}
        </select>
      </div>

      <div className="format-picker">
        <div>
          <strong>Video Format</strong>
          <small>{videoFormats.selectedFormat?.description ?? "Standard UVC stream"}</small>
        </div>
        <select
          className="device-select"
          aria-label="Select video format"
          value={videoFormats.selectedKey}
          disabled={videoFormats.formats.length === 0 || videoFormats.pending}
          onChange={(event) => void videoFormats.setSelectedKey(event.target.value)}
        >
          {videoFormats.formats.length === 0 && <option value="">No formats</option>}
          {videoFormats.formats.map((format) => {
            const key = formatKey(format);
            return (
              <option key={key} value={key}>
                {format.label}
              </option>
            );
          })}
        </select>
        {videoFormats.error && <small className="format-error">{videoFormats.error}</small>}
      </div>

      <button className="secondary-button" onClick={() => void devices.refresh()}>
        <RotateCw size={16} />
        Refresh devices
      </button>

      <div className="device-meta">
        <Cpu size={16} />
        <span>{devices.selectedDevice?.driver ?? "Awaiting driver"}</span>
      </div>

      <div className="rail-divider" />

      <div className="rail-section-title">Capabilities Summary</div>
      <div className="capability-list">
        {capabilityRows.map((row) => {
          const Icon = row.icon;
          return (
            <div className="capability-row" key={row.label}>
              <Icon size={16} />
              <div>
                <strong>{row.label}</strong>
                <small>{row.detail}</small>
              </div>
              <em className={row.ready ? "is-ok" : row.partial ? "is-partial" : ""}>
                {row.ready ? "OK" : row.partial ? "Partial" : "Wait"}
              </em>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
