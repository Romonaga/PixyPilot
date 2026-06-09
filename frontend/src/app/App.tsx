import { AppShell } from "../components/layout/AppShell";
import { useAudio } from "../hooks/useAudio";
import { useControls } from "../hooks/useControls";
import { useDevices } from "../hooks/useDevices";
import { usePixyHid } from "../hooks/usePixyHid";

export function App() {
  const devices = useDevices();
  const controls = useControls(devices.selectedDeviceName);
  const pixyHid = usePixyHid();
  const audio = useAudio();

  return <AppShell devices={devices} controls={controls} pixyHid={pixyHid} audio={audio} />;
}
