import { AppShell } from "../components/layout/AppShell";
import { useAudio } from "../hooks/useAudio";
import { useControls } from "../hooks/useControls";
import { useDevices } from "../hooks/useDevices";
import { usePixyHid } from "../hooks/usePixyHid";
import { usePrivacySafety } from "../hooks/usePrivacySafety";
import { useVideoFormats } from "../hooks/useVideoFormats";

export function App() {
  const devices = useDevices();
  const controls = useControls(devices.selectedDeviceName);
  const videoFormats = useVideoFormats(devices.selectedDeviceName);
  const pixyHid = usePixyHid();
  const audio = useAudio();
  const privacySafety = usePrivacySafety(pixyHid, audio);

  return (
    <AppShell
      devices={devices}
      controls={controls}
      videoFormats={videoFormats}
      pixyHid={pixyHid}
      audio={audio}
      privacySafety={privacySafety}
    />
  );
}
