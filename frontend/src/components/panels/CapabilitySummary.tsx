import { Activity, Gauge, SlidersHorizontal } from "lucide-react";

import type { UseControlsResult } from "../../hooks/useControls";
import type { UseDevicesResult } from "../../hooks/useDevices";

type Props = {
  devices: UseDevicesResult;
  controls: UseControlsResult;
};

export function CapabilitySummary({ devices, controls }: Props) {
  const ptzCount = controls.controls.filter((control) =>
    ["pan_absolute", "tilt_absolute", "zoom_absolute"].includes(control.name)
  ).length;

  return (
    <section className="summary-band">
      <div className="summary-copy">
        <span className="section-label">Current target</span>
        <h2>{devices.selectedDevice?.name ?? "No camera selected"}</h2>
        <p>{devices.selectedDevice?.bus_info ?? "Connect a PIXY device to begin."}</p>
      </div>
      <div className="summary-metrics">
        <div>
          <Activity size={18} />
          <span>{controls.controls.length}</span>
          <small>Controls</small>
        </div>
        <div>
          <Gauge size={18} />
          <span>{ptzCount}</span>
          <small>PTZ axes</small>
        </div>
        <div>
          <SlidersHorizontal size={18} />
          <span>{controls.groups.length}</span>
          <small>Groups</small>
        </div>
      </div>
    </section>
  );
}
