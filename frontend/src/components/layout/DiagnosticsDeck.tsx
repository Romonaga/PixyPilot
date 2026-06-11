import { RadioTower } from "lucide-react";

import type { UseAudioResult } from "../../hooks/useAudio";
import type { UseControlsResult } from "../../hooks/useControls";
import type { UsePixyHidResult } from "../../hooks/usePixyHid";
import type { UsePrivacySafetyResult } from "../../hooks/usePrivacySafety";
import type { UseVideoCaptureResult } from "../../hooks/useVideoCapture";
import type { UseVideoFormatsResult } from "../../hooks/useVideoFormats";
import { CommandLogPanel } from "../panels/CommandLogPanel";
import { ExperimentalPanel } from "../panels/ExperimentalPanel";
import { HidDiagnosticsPanel } from "../panels/HidDiagnosticsPanel";
import { PcapImportPanel } from "../panels/PcapImportPanel";
import { RuntimeConfigPanel } from "../panels/RuntimeConfigPanel";

type Props = {
  deviceName: string | null;
  controls: UseControlsResult;
  videoFormats: UseVideoFormatsResult;
  videoCapture: UseVideoCaptureResult;
  pixyHid: UsePixyHidResult;
  audio: UseAudioResult;
  privacySafety: UsePrivacySafetyResult;
};

export function DiagnosticsDeck({
  deviceName,
  controls,
  videoFormats,
  videoCapture,
  pixyHid,
  audio,
  privacySafety
}: Props) {
  return (
    <div className="diagnostics-console">
      <div className="diagnostics-intro">
        <SignalPanel isLoading={controls.isLoading} />
        <RuntimeConfigPanel privacySafety={privacySafety} />
      </div>
      <div className="diagnostics-grid">
        <HidDiagnosticsPanel />
        <ExperimentalPanel deviceName={deviceName} />
        <PcapImportPanel />
        <CommandLogPanel
          controls={controls}
          videoFormats={videoFormats}
          videoCapture={videoCapture}
          pixyHid={pixyHid}
          audio={audio}
          privacySafety={privacySafety}
        />
      </div>
    </div>
  );
}

function SignalPanel({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="signal-panel">
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
