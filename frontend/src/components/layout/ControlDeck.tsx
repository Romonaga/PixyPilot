import { RadioTower } from "lucide-react";

import type { UseAudioResult } from "../../hooks/useAudio";
import type { UseControlPresetsResult } from "../../hooks/useControlPresets";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { UseVideoCaptureResult } from "../../hooks/useVideoCapture";
import type { UseVideoFormatsResult } from "../../hooks/useVideoFormats";
import { ControlGroupPanel } from "../controls/ControlGroupPanel";
import { SmartPixyPanel } from "../panels/SmartPixyPanel";
import { VideoMonitor } from "../panels/VideoMonitor";

type Props = {
  deviceName: string | null;
  controls: UseControlsResult;
  videoFormats: UseVideoFormatsResult;
  videoCapture: UseVideoCaptureResult;
  pixyHid: UsePixyHidResult;
  audio: UseAudioResult;
  privacySafety: UsePrivacySafetyResult;
  controlPresets: UseControlPresetsResult;
};

export function ControlDeck({
  deviceName,
  controls,
  videoFormats,
  videoCapture,
  pixyHid,
  audio,
  privacySafety,
  controlPresets
}: Props) {
  return (
    <div className="operator-deck">
      <div className="operator-main">
        <VideoMonitor
          deviceName={deviceName}
          videoFormats={videoFormats}
          videoCapture={videoCapture}
          pixyHid={pixyHid}
        />
        <div className="control-grid">
          {controls.groups.filter((group) => group.id !== "smart").map((group) => (
            <ControlGroupPanel
              key={group.id}
              group={group}
              controls={controls}
              pixyHid={pixyHid}
              controlPresets={controlPresets}
            />
          ))}
        </div>
      </div>
      <aside className="operator-side">
        <SignalPanel isLoading={controls.isLoading} />
        <SmartPixyPanel pixyHid={pixyHid} audio={audio} privacySafety={privacySafety} />
      </aside>
    </div>
  );
}

function SignalPanel({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="signal-panel compact-signal-panel">
      <div className="panel-title-row">
        <RadioTower size={18} />
        <h2>Signal</h2>
      </div>
      <div className="telemetry-stack">
        <span>V4L2 online</span>
        <strong>{isLoading ? "Scanning" : "Ready"}</strong>
      </div>
    </div>
  );
}
