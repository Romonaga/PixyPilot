import { useEffect } from "react";

export type HotplugEvent = {
  action: string;
  subsystem: string;
  device_node: string | null;
  device_type: "video" | "hid";
};

type Handlers = {
  onVideo: () => void;
  onHid: () => void;
};

export function useHotplugEvents({ onVideo, onHid }: Handlers) {
  useEffect(() => {
    const source = new EventSource("/api/hotplug/events");

    source.addEventListener("open", () => {
      onVideo();
      onHid();
    });

    source.addEventListener("hotplug", (event) => {
      const hotplugEvent = parseHotplugEvent(event);
      if (hotplugEvent?.device_type === "video") {
        onVideo();
      }
      if (hotplugEvent?.device_type === "hid") {
        onHid();
      }
    });

    return () => source.close();
  }, [onHid, onVideo]);
}

function parseHotplugEvent(event: Event): HotplugEvent | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
    return null;
  }

  try {
    return JSON.parse(event.data) as HotplugEvent;
  } catch {
    return null;
  }
}
