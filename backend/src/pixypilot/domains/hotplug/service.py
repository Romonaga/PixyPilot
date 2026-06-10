from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

import pyudev

from pixypilot.domains.hotplug.models import HotplugEvent

HOTPLUG_SUBSYSTEMS = {"video4linux", "hidraw"}


class HotplugService:
    async def events(self) -> AsyncIterator[HotplugEvent]:
        queue: asyncio.Queue[HotplugEvent | None] = asyncio.Queue()
        loop = asyncio.get_running_loop()
        observer = _start_observer(loop, queue)

        try:
            while True:
                event = await queue.get()
                if event is None:
                    return
                yield event
        finally:
            observer.stop()
            observer.join(timeout=1)


def _start_observer(
    loop: asyncio.AbstractEventLoop,
    queue: asyncio.Queue[HotplugEvent | None],
) -> pyudev.MonitorObserver:
    context = pyudev.Context()
    monitor = pyudev.Monitor.from_netlink(context)

    def handle_event(device: pyudev.Device) -> None:
        event = _event_from_device(device)
        if event is None:
            return
        loop.call_soon_threadsafe(queue.put_nowait, event)

    observer = pyudev.MonitorObserver(monitor, callback=handle_event)
    observer.start()
    return observer


def _event_from_device(device: pyudev.Device) -> HotplugEvent | None:
    subsystem = device.subsystem
    if subsystem not in HOTPLUG_SUBSYSTEMS:
        return None

    device_node = device.device_node
    if subsystem == "video4linux":
        device_type = "video"
    elif subsystem == "hidraw":
        device_type = "hid"
    else:
        return None

    return HotplugEvent(
        action=device.action or "change",
        subsystem=subsystem,
        device_node=device_node,
        device_type=device_type,
    )


def get_hotplug_service() -> HotplugService:
    return HotplugService()
