from fastapi import APIRouter, Depends, HTTPException

from pixypilot.domains.devices.models import Device
from pixypilot.domains.v4l2.models import ControlSetRequest, V4L2Control
from pixypilot.domains.v4l2.service import V4L2Service, get_v4l2_service

router = APIRouter()


@router.get("/devices", response_model=list[Device])
async def list_devices(service: V4L2Service = Depends(get_v4l2_service)) -> list[Device]:
    return await service.list_devices()


@router.get("/devices/{device_name}/controls", response_model=list[V4L2Control])
async def list_controls(
    device_name: str,
    service: V4L2Service = Depends(get_v4l2_service),
) -> list[V4L2Control]:
    device_path = service.device_path_from_name(device_name)
    try:
        return await service.list_controls(device_path)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/devices/{device_name}/controls/{control_name}", response_model=V4L2Control)
async def set_control(
    device_name: str,
    control_name: str,
    request: ControlSetRequest,
    service: V4L2Service = Depends(get_v4l2_service),
) -> V4L2Control:
    device_path = service.device_path_from_name(device_name)
    try:
        return await service.set_control(device_path, control_name, request.value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
