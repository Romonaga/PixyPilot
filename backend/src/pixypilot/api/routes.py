from fastapi import APIRouter, Depends, HTTPException, Query, Request
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
from pixypilot.domains.hotplug.service import HotplugService, get_hotplug_service
from pixypilot.domains.pcap_import.models import PcapImportRecord
from pixypilot.domains.pcap_import.service import PcapImportService, get_pcap_import_service
from pixypilot.domains.pixy_hid.models import (
    AudioModeRequest,
    AutoPrivacyRequest,
    FocusMeteringRequest,
    GestureRequest,
    MirrorRequest,
    PixyHidCommandResult,
    PixyHidDeviceState,
    PixyHidDiagnosticSnapshot,
    PixyHidQueryName,
    PixyHidRawQueryResult,
    PixyHidStatus,
    PtzAbsoluteRequest,
    PtzDirectionRequest,
    PtzPresetSlotRequest,
    PtzRelativeRequest,
    PtzVectorRequest,
    TargetTrackingRequest,
    TrackingModeRequest,
)
from pixypilot.domains.pixy_hid.service import PixyHidService, get_pixy_hid_service
from pixypilot.domains.settings.models import AppSettings, AppSettingsUpdate
from pixypilot.domains.settings.service import SettingsService, get_settings_service
from pixypilot.domains.uvc_extension.models import UvcExtensionSelectorProbe, UvcExtensionSnapshot
from pixypilot.domains.uvc_extension.service import UvcExtensionService, get_uvc_extension_service
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
    VideoStreamStopResult,
    VideoStreamSettings,
)
from pixypilot.domains.video.service import VideoService, get_video_service

router = APIRouter()


@router.get("/hotplug/events")
async def hotplug_events(
    service: HotplugService = Depends(get_hotplug_service),
    video_service: VideoService = Depends(get_video_service),
) -> StreamingResponse:
    async def event_stream():
        async for event in service.events():
            if event.device_type == "video" and event.action == "remove" and event.device_node:
                await video_service.stop_streams(event.device_node)
            yield f"event: hotplug\ndata: {event.model_dump_json()}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/settings", response_model=AppSettings)
async def get_settings(
    service: SettingsService = Depends(get_settings_service),
) -> AppSettings:
    try:
        return await service.get_settings()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.patch("/settings", response_model=AppSettings)
async def update_settings(
    request: AppSettingsUpdate,
    service: SettingsService = Depends(get_settings_service),
) -> AppSettings:
    try:
        return await service.update_settings(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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


@router.get("/devices/{device_name}/uvc-extension/selectors", response_model=list[UvcExtensionSelectorProbe])
async def probe_uvc_extension_selectors(
    device_name: str,
    v4l2_service: V4L2Service = Depends(get_v4l2_service),
    uvc_service: UvcExtensionService = Depends(get_uvc_extension_service),
) -> list[UvcExtensionSelectorProbe]:
    try:
        device_path = v4l2_service.device_path_from_name(device_name)
        return await uvc_service.probe_selectors(device_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/devices/{device_name}/uvc-extension/capture", response_model=UvcExtensionSnapshot)
async def capture_uvc_extension_snapshot(
    device_name: str,
    save: bool = Query(default=False),
    v4l2_service: V4L2Service = Depends(get_v4l2_service),
    uvc_service: UvcExtensionService = Depends(get_uvc_extension_service),
) -> UvcExtensionSnapshot:
    try:
        device_path = v4l2_service.device_path_from_name(device_name)
        return await uvc_service.capture_snapshot(device_path, save=save)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/pcap-imports", response_model=list[PcapImportRecord])
async def list_pcap_imports(
    service: PcapImportService = Depends(get_pcap_import_service),
) -> list[PcapImportRecord]:
    return await service.list_captures()


@router.post("/pcap-imports", response_model=PcapImportRecord)
async def upload_pcap_import(
    request: Request,
    filename: str = Query(..., min_length=1),
    action: str | None = Query(default=None),
    notes: str | None = Query(default=None),
    source: str = Query(default="windows"),
    service: PcapImportService = Depends(get_pcap_import_service),
) -> PcapImportRecord:
    try:
        return await service.save_capture(
            filename=filename,
            chunks=request.stream(),
            action=action,
            notes=notes,
            source=source,
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


@router.post("/devices/{device_name}/stream/stop", response_model=VideoStreamStopResult)
async def stop_video_stream(
    device_name: str,
    v4l2_service: V4L2Service = Depends(get_v4l2_service),
    video_service: VideoService = Depends(get_video_service),
) -> VideoStreamStopResult:
    try:
        device_path = v4l2_service.device_path_from_name(device_name)
        await video_service.stop_streams(device_path)
        return VideoStreamStopResult(ok=True, device_name=device_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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


@router.get("/pixy-hid/state", response_model=PixyHidDeviceState)
async def pixy_hid_state(
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidDeviceState:
    try:
        return await service.query_state()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/pixy-hid/query/{query_name}", response_model=PixyHidRawQueryResult)
async def pixy_hid_query(
    query_name: PixyHidQueryName,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidRawQueryResult:
    try:
        return await service.query_raw(query_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/pixy-hid/queries", response_model=list[PixyHidRawQueryResult])
async def pixy_hid_queries(
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> list[PixyHidRawQueryResult]:
    try:
        return await service.query_raw_all()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/pixy-hid/diagnostics/capture", response_model=PixyHidDiagnosticSnapshot)
async def capture_pixy_hid_diagnostics(
    save: bool = Query(default=False),
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidDiagnosticSnapshot:
    try:
        return await service.capture_diagnostics(save=save)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


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


@router.patch("/pixy-hid/target-tracking", response_model=PixyHidCommandResult)
async def set_pixy_target_tracking(
    request: TargetTrackingRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.set_target_tracking(request.mode, request.x, request.y, request.scale)
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


@router.patch("/pixy-hid/ptz-relative", response_model=PixyHidCommandResult)
async def send_pixy_ptz_relative(
    request: PtzRelativeRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.send_ptz_relative(request.direction, request.degrees)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/ptz-absolute", response_model=PixyHidCommandResult)
async def send_pixy_ptz_absolute(
    request: PtzAbsoluteRequest,
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.send_ptz_absolute(request.pan, request.tilt)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.patch("/pixy-hid/ptz-recenter", response_model=PixyHidCommandResult)
async def recenter_pixy_ptz(
    service: PixyHidService = Depends(get_pixy_hid_service),
) -> PixyHidCommandResult:
    try:
        return await service.recenter_ptz()
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
