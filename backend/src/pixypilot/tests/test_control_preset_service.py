import pytest

from pixypilot.domains.control_presets.models import ControlPresetCreateRequest
from pixypilot.domains.control_presets.service import ControlPresetService


async def test_missing_preset_file_returns_empty_list(tmp_path) -> None:
    service = ControlPresetService(tmp_path / "missing.yaml")

    presets = await service.list_presets()

    assert presets == []


async def test_create_and_list_presets_from_yaml(tmp_path) -> None:
    service = ControlPresetService(tmp_path / "presets.yaml")

    preset = await service.create_preset(
        ControlPresetCreateRequest(
            name="  Desk Light  ",
            scope="image",
            values={"brightness": 180, "contrast": 140},
        )
    )

    reloaded = ControlPresetService(tmp_path / "presets.yaml")
    presets = await reloaded.list_presets("image")

    assert presets == [preset]
    assert presets[0].name == "Desk Light"
    assert presets[0].values == {"brightness": 180, "contrast": 140}


async def test_delete_preset_removes_it_from_store(tmp_path) -> None:
    service = ControlPresetService(tmp_path / "presets.yaml")
    preset = await service.create_preset(
        ControlPresetCreateRequest(name="Manual Focus", scope="focus", values={"focus_absolute": 512})
    )

    result = await service.delete_preset(preset.id)

    assert result.ok is True
    assert await service.list_presets() == []


async def test_delete_unknown_preset_raises(tmp_path) -> None:
    service = ControlPresetService(tmp_path / "presets.yaml")

    with pytest.raises(ValueError, match="Unknown preset"):
        await service.delete_preset("missing")
