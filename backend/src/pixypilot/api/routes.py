from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from pixypilot.domains.audio.models import AudioCommandResult, AudioMuteRequest, AudioStatus
from pixypilot.domains.audio.service import AudioService, get_audio_service
from pixypilot.domains.control_presets.models import (
    ControlPreset,
    ControlPresetCreateRequest,
    ControlPresetDeleteResult,
    ControlPresetScope,
)
from pixypilot.domains.control_presets.service import ControlPresetService, get_control_preset_service
from pixypilot.domains.devices.models import Device
from pixypilot.domains.pixy_hid.models import (
    AudioModeRequest,
    AutoPrivacyRequest,
    FocusMeteringRequest,
    GestureRequest,
    MirrorRequest,
    PixyHidCommandResult,
    PixyHidStatus,
    PtzDirectionRequest,
    PtzPresetSlotRequest,
    PtzVectorRequest,
    TrackingModeRequest,
)
from pixypilot.domains.pixy_hid.service import PixyHidService, get_pixy_hid_service
from pixypilot.domains.settings.models import AppSettings
from pixypilot.domains.settings.service import SettingsService, get_settings_service
from pixypilot.domains.v4l2.models import (
    ControlSetRequest,
    V4L2Control,
    VideoFormatOption,
    VideoFormatSetRequest,
)
from pixypilot.domains.v4l2.service import V4L2Service, get_v4l2_service
from pixypilot.domains.video.models import (
    VideoRecordingRequest,
    VideoRecordingStatus,
    VideoStreamSettings,
)
from pixypilot.domains.video.service import VideoService, get_video_service

router = APIRouter()


@router.get("/settings", response_model=AppSettings)
async def get_settings(
    service: SettingsService = Depends(get_settings_service),
) -> AppSettings:
    try:
        return await service.get_settings()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/control-presets", response_model=list[ControlPreset])
async def list_control_presets(
    scope: ControlPresetScope | None = Query(default=None),
    service: ControlPresetService = Depends(get_control_preset_service),
) -> list[ControlPreset]:
    try:
        return await service.list_presets(scope)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/control-presets", response_model=ControlPreset)
async def create_control_preset(
    request: ControlPresetCreateRequest,
    service: ControlPresetService = Depends(get_control_preset_service),
) -> ControlPreset:
    return await service.create_preset(request)


@router.delete("/control-presets/{preset_id}", response_model=ControlPresetDeleteResult)
async def delete_control_preset(
    preset_id: str,
    service: ControlPresetService = Depends(get_control_preset_service),
) -> ControlPresetDeleteResult:
    try:
        return await service.delete_preset(preset_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


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


@router.get("/devices/{device_name}/formats", response_model=list[VideoFormatOption])
async def list_formats(
    device_name: str,
    service: V4L2Service = Depends(get_v4l2_service),
) -> list[VideoFormatOption]:
    device_path = service.device_path_from_name(device_name)
    try:
        return await service.list_formats(device_path)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/devices/{device_name}/format", response_model=VideoFormatOption)
async def set_format(
    device_name: str,
    request: VideoFormatSetRequest,
    service: V4L2Service = Depends(get_v4l2_service),
    video_service: VideoService = Depends(get_video_service),
) -> VideoFormatOption:
    device_path = service.device_path_from_name(device_name)
    try:
        await video_service.stop_streams(device_path)
        return await service.set_format(
            device_path,
            request.pixel_format,
            request.width,
            request.height,
            request.fps,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/devices/{device_name}/stream")
async def stream_video(
    device_name: str,
    pixel_format: str = Query(default="MJPG"),
    width: int = Query(default=1280, ge=1),
    height: int = Query(default=720, ge=1),
    fps: float = Query(default=30, gt=0),
    v4l2_service: V4L2Service = Depends(get_v4l2_service),
    video_service: VideoService = Depends(get_video_service),
) -> StreamingResponse:
    try:
        device_path = v4l2_service.device_path_from_name(device_name)
        settings = VideoStreamSettings(pixel_format=pixel_format, width=width, height=height, fps=fps)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StreamingResponse(
        video_service.mjpeg_stream(device_path, settings),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/video/recording/status", response_model=VideoRecordingStatus)
async def recording_status(
    video_service: VideoService = Depends(get_video_service),
) -> VideoRecordingStatus:
    return await video_service.recording_status()


@router.post("/devices/{device_name}/recording/start", response_model=VideoRecordingStatus)
async def start_recording(
    device_name: str,
    request: VideoRecordingRequest,
    v4l2_service: V4L2Service = Depends(get_v4l2_service),
    video_service: VideoService = Depends(get_video_service),
) -> VideoRecordingStatus:
    try:
        device_path = v4l2_service.device_path_from_name(device_name)
        await video_service.stop_streams(device_path)
        return await video_service.start_recording(device_name, device_path, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/video/recording/stop", response_model=VideoRecordingStatus)
async def stop_recording(
    video_service: VideoService = Depends(get_video_service),
) -> VideoRecordingStatus:
    return await video_service.stop_recording()


@router.get("/audio/status", response_model=AudioStatus)
async def audio_status(
    service: AudioService = Depends(get_audio_service),
) -> AudioStatus:
    return await service.status()


@router.patch("/audio/mute", response_model=AudioCommandResult)
async def set_audio_mute(
    request: AudioMuteRequest,
    service: AudioService = Depends(get_audio_service),
) -> AudioCommandResult:
    try:
        return await service.set_mute(request.muted)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/pixy-hid/status", response_model=PixyHidStatus)
async def pixy_hid_status(
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidStatus:
    return await service.status()


@router.patch("/pixy-hid/tracking", response_model=PixyHidCommandResult)
async def set_pixy_tracking(
    request: TrackingModeRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.set_tracking(request.mode)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/gesture", response_model=PixyHidCommandResult)
async def set_pixy_gesture(
    request: GestureRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.set_gesture(request.enabled)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/auto-rotate", response_model=PixyHidCommandResult)
async def set_pixy_auto_rotate(
    request: GestureRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.set_auto_rotate(request.enabled)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/mirror", response_model=PixyHidCommandResult)
async def set_pixy_mirror(
    request: MirrorRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.set_mirror(request.horizontal, request.vertical)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/focus-metering", response_model=PixyHidCommandResult)
async def set_pixy_focus_metering(
    request: FocusMeteringRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.set_focus_metering(request.mode, request.x, request.y)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/audio", response_model=PixyHidCommandResult)
async def set_pixy_audio(
    request: AudioModeRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.set_audio_mode(request.mode)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/auto-privacy", response_model=PixyHidCommandResult)
async def set_pixy_auto_privacy(
    request: AutoPrivacyRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.set_auto_privacy(request.timeout_seconds)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/ptz-direction", response_model=PixyHidCommandResult)
async def send_pixy_ptz_direction(
    request: PtzDirectionRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.send_ptz_direction(request.direction)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/ptz-vector", response_model=PixyHidCommandResult)
async def send_pixy_ptz_vector(
    request: PtzVectorRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.send_ptz_vector(request.x, request.y, request.z)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/ptz-preset/save", response_model=PixyHidCommandResult)
async def save_pixy_ptz_preset(
    request: PtzPresetSlotRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.save_ptz_preset(request.slot)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/ptz-preset/load", response_model=PixyHidCommandResult)
async def load_pixy_ptz_preset(
    request: PtzPresetSlotRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.load_ptz_preset(request.slot)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
