import { useCallback } from "react";

import { AppShell } from "../components/layout/AppShell";
import { useAudio } from "../hooks/useAudio";
import { useControlPresets } from "../hooks/useControlPresets";
import { useControls } from "../hooks/useControls";
import { useDevices } from "../hooks/useDevices";
import { useHotplugEvents } from "../hooks/useHotplugEvents";
import { usePixyHid } from "../hooks/usePixyHid";
import { usePrivacySafety } from "../hooks/usePrivacySafety";
import { useVideoCapture } from "../hooks/useVideoCapture";
import { useVideoFormats } from "../hooks/useVideoFormats";

export function App() {
  const devices = useDevices();
  const controls = useControls(devices.selectedDeviceName);
  const videoFormats = useVideoFormats(devices.selectedDeviceName);
  const videoCapture = useVideoCapture(devices.selectedDeviceName, videoFormats.selectedFormat);
  const pixyHid = usePixyHid();
  const audio = useAudio();
  const privacySafety = usePrivacySafety(pixyHid, audio);
  const controlPresets = useControlPresets();
  const handleVideoHotplug = useCallback(() => {
    void devices.refresh({ showLoading: false });
  }, [devices.refresh]);
  const handleHidHotplug = useCallback(() => {
    void pixyHid.refreshStatus({ showLoading: false });
  }, [pixyHid.refreshStatus]);

  useHotplugEvents({
    onVideo: handleVideoHotplug,
    onHid: handleHidHotplug
  });

  return (
    <AppShell
      devices={devices}
      controls={controls}
      videoFormats={videoFormats}
      videoCapture={videoCapture}
      pixyHid={pixyHid}
      audio={audio}
      privacySafety={privacySafety}
      controlPresets={controlPresets}
    />
  );
}
