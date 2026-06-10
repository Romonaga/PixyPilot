import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHotplugEvents } from "./useHotplugEvents";

type Listener = (event: Event) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, Listener>();
  closed = false;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(data) }));
  }

  open() {
    this.listeners.get("open")?.(new Event("open"));
  }
}

describe("useHotplugEvents", () => {
  const originalEventSource = globalThis.EventSource;

  afterEach(() => {
    MockEventSource.instances = [];
    vi.restoreAllMocks();
    globalThis.EventSource = originalEventSource;
  });

  it("subscribes to backend hotplug events and routes video and HID refreshes", () => {
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    const onVideo = vi.fn();
    const onHid = vi.fn();

    const { unmount } = renderHook(() => useHotplugEvents({ onVideo, onHid }));
    const source = MockEventSource.instances[0];

    expect(source.url).toBe("/api/hotplug/events");

    source.open();

    expect(onVideo).toHaveBeenCalledTimes(1);
    expect(onHid).toHaveBeenCalledTimes(1);

    source.emit("hotplug", {
      action: "add",
      subsystem: "video4linux",
      device_node: "/dev/video0",
      device_type: "video"
    });
    source.emit("hotplug", {
      action: "add",
      subsystem: "hidraw",
      device_node: "/dev/hidraw14",
      device_type: "hid"
    });

    expect(onVideo).toHaveBeenCalledTimes(2);
    expect(onHid).toHaveBeenCalledTimes(2);

    unmount();

    expect(source.closed).toBe(true);
  });
});
