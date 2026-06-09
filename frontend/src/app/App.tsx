import { AppShell } from "../components/layout/AppShell";
import { useControls } from "../hooks/useControls";
import { useDevices } from "../hooks/useDevices";

export function App() {
  const devices = useDevices();
  const controls = useControls(devices.selectedDeviceName);

  return <AppShell devices={devices} controls={controls} />;
}
