from pixypilot.domains.settings.models import AppSettingsUpdate
from pixypilot.domains.settings.service import SettingsService


async def test_missing_settings_file_defaults_to_starting_in_privacy(tmp_path) -> None:
    service = SettingsService(tmp_path / "missing.yaml")

    settings = await service.get_settings()

    assert settings.safety.start_in_privacy is True
    assert settings.server.host == "127.0.0.1"
    assert settings.server.port == 8000


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


async def test_settings_file_reports_runtime_paths(tmp_path) -> None:
    project = tmp_path / "project"
    config_dir = project / "config"
    config_dir.mkdir(parents=True)
    settings_path = config_dir / "pixypilot.yaml"
    settings_path.write_text(
        """
server:
  host: 0.0.0.0
  port: 8012
storage:
  presets: config/my-presets.yaml
  recordings: captures
hid:
  path: /dev/hidraw9
  report_gap_ms: 40
""",
        encoding="utf-8",
    )
    service = SettingsService(settings_path)

    settings = await service.get_settings()

    assert settings.server.url == "http://0.0.0.0:8012"
    assert settings.storage.presets_path == str(project / "config" / "my-presets.yaml")
    assert settings.storage.recordings_dir == str(project / "captures")
    assert settings.hid.path == "/dev/hidraw9"
    assert settings.hid.report_gap_ms == 40
    assert settings.config.path == str(settings_path)


async def test_settings_update_patches_yaml_without_dropping_existing_values(tmp_path) -> None:
    settings_path = tmp_path / "pixypilot.yaml"
    settings_path.write_text(
        """
server:
  host: 127.0.0.1
  port: 8000
frontend:
  dev_server:
    host: 127.0.0.1
    port: 5173
hid:
  report_gap_ms: 25
""",
        encoding="utf-8",
    )
    service = SettingsService(settings_path)

    settings = await service.update_settings(
        AppSettingsUpdate.model_validate(
            {
                "frontend": {"dev_server": {"port": 5174}},
                "hid": {"path": "/dev/hidraw14"},
            }
        )
    )

    assert settings.frontend.dev_server_host == "127.0.0.1"
    assert settings.frontend.dev_server_port == 5174
    assert settings.hid.path == "/dev/hidraw14"
    assert settings.hid.report_gap_ms == 25
    assert "port: 8000" in settings_path.read_text(encoding="utf-8")


async def test_empty_settings_update_does_not_rewrite_yaml(tmp_path) -> None:
    settings_path = tmp_path / "pixypilot.yaml"
    original_yaml = """
safety:
  start_in_privacy: true

hid:
  path:
  report_gap_ms: 25
"""
    settings_path.write_text(original_yaml, encoding="utf-8")
    service = SettingsService(settings_path)

    await service.update_settings(AppSettingsUpdate())

    assert settings_path.read_text(encoding="utf-8") == original_yaml
