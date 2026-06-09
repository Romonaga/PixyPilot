import { Camera, Cpu, RotateCw } from "lucide-react";

import type { UseDevicesResult } from "../../hooks/useDevices";

function deviceNameFromPath(path: string): string {
  return path.split("/").at(-1) ?? path;
}

type Props = {
  devices: UseDevicesResult;
};

export function DeviceRail({ devices }: Props) {
  return (
    <aside className="device-rail">
      <div className="panel-title-row">
        <Camera size={18} />
        <h2>Device Bay</h2>
      </div>

      <div className="device-list">
        {devices.devices.map((device) => {
          const deviceName = deviceNameFromPath(device.path);
          const selected = deviceName === devices.selectedDeviceName;
          return (
            <button
              className={`device-tile ${selected ? "is-selected" : ""}`}
              key={device.path}
              onClick={() => devices.setSelectedDeviceName(deviceName)}
            >
              <span>{deviceName}</span>
              <strong>{device.name}</strong>
              <small>{device.is_capture ? "Capture" : "Metadata"}</small>
            </button>
          );
        })}
      </div>

      <button className="secondary-button" onClick={() => void devices.refresh()}>
        <RotateCw size={16} />
        Refresh devices
      </button>

      <div className="device-meta">
        <Cpu size={16} />
        <span>{devices.selectedDevice?.driver ?? "Awaiting driver"}</span>
      </div>
    </aside>
  );
}
