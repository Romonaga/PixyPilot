from pixypilot.domains.settings.service import SettingsService


async def test_missing_settings_file_defaults_to_starting_in_privacy(tmp_path) -> None:
    service = SettingsService(tmp_path / "missing.yaml")

    settings = await service.get_settings()

    assert settings.safety.start_in_privacy is True


async def test_settings_file_can_disable_startup_privacy(tmp_path) -> None:
    settings_path = tmp_path / "pixypilot.yaml"
    settings_path.write_text(
        """
safety:
  start_in_privacy: false
""",
        encoding="utf-8",
    )
    service = SettingsService(settings_path)

    settings = await service.get_settings()

    assert settings.safety.start_in_privacy is False
