import asyncio
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import yaml

from pixypilot.domains.control_presets.models import (
    ControlPreset,
    ControlPresetCreateRequest,
    ControlPresetDeleteResult,
    ControlPresetScope,
    ControlPresetStore,
)


def default_presets_path() -> Path:
    configured = os.environ.get("PIXYPILOT_PRESETS_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[5] / "config" / "presets.yaml"


class ControlPresetService:
    def __init__(self, presets_path: Path | None = None) -> None:
        self.presets_path = presets_path or default_presets_path()

    async def list_presets(self, scope: ControlPresetScope | None = None) -> list[ControlPreset]:
        store = await asyncio.to_thread(self._read_store)
        presets = store.presets
        if scope is not None:
            presets = [preset for preset in presets if preset.scope == scope]
        return sorted(presets, key=lambda preset: (preset.scope, preset.name.lower(), preset.created_at))

    async def create_preset(self, request: ControlPresetCreateRequest) -> ControlPreset:
        preset = ControlPreset(
            id=uuid4().hex,
            name=request.name,
            scope=request.scope,
            values=dict(request.values),
            created_at=datetime.now(UTC).isoformat(timespec="seconds"),
        )
        await asyncio.to_thread(self._append_preset, preset)
        return preset

    async def delete_preset(self, preset_id: str) -> ControlPresetDeleteResult:
        deleted = await asyncio.to_thread(self._delete_preset, preset_id)
        if not deleted:
            raise ValueError(f"Unknown preset: {preset_id}")
        return ControlPresetDeleteResult(ok=True, id=preset_id)

    def _read_store(self) -> ControlPresetStore:
        if not self.presets_path.exists():
            return ControlPresetStore()

        raw_store = yaml.safe_load(self.presets_path.read_text(encoding="utf-8"))
        if raw_store is None:
            return ControlPresetStore()
        if not isinstance(raw_store, dict):
            raise ValueError("PixyPilot presets must be a YAML mapping")

        return ControlPresetStore.model_validate(_string_keys(raw_store))

    def _append_preset(self, preset: ControlPreset) -> None:
        store = self._read_store()
        store.presets.append(preset)
        self._write_store(store)

    def _delete_preset(self, preset_id: str) -> bool:
        store = self._read_store()
        kept = [preset for preset in store.presets if preset.id != preset_id]
        if len(kept) == len(store.presets):
            return False
        self._write_store(ControlPresetStore(presets=kept))
        return True

    def _write_store(self, store: ControlPresetStore) -> None:
        self.presets_path.parent.mkdir(parents=True, exist_ok=True)
        payload = store.model_dump(mode="json")
        self.presets_path.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")


def _string_keys(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _string_keys(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_string_keys(item) for item in value]
    return value


def get_control_preset_service() -> ControlPresetService:
    return ControlPresetService()
