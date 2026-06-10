from pixypilot import config


def test_backend_bind_defaults(tmp_path) -> None:
    config_path = tmp_path / "missing.yaml"

    assert config.backend_host(config_path) == "127.0.0.1"
    assert config.backend_port(config_path) == 8000


def test_backend_bind_can_be_configured_in_yaml(tmp_path) -> None:
    config_path = tmp_path / "pixypilot.yaml"
    config_path.write_text(
        """
server:
  host: 0.0.0.0
  port: 8010
""",
        encoding="utf-8",
    )

    assert config.backend_host(config_path) == "0.0.0.0"
    assert config.backend_port(config_path) == 8010


def test_cors_origins_follow_frontend_bind_settings(tmp_path) -> None:
    config_path = tmp_path / "pixypilot.yaml"
    config_path.write_text(
        """
frontend:
  dev_server:
    host: 0.0.0.0
    port: 5174
""",
        encoding="utf-8",
    )

    assert config.cors_origins(config_path) == ["http://0.0.0.0:5174"]


def test_cors_origins_can_be_configured_explicitly(tmp_path) -> None:
    config_path = tmp_path / "pixypilot.yaml"
    config_path.write_text(
        """
cors:
  origins:
    - http://camera.local:5173
    - http://127.0.0.1:5173
""",
        encoding="utf-8",
    )

    assert config.cors_origins(config_path) == ["http://camera.local:5173", "http://127.0.0.1:5173"]


def test_paths_resolve_relative_to_project_root_when_config_lives_under_config(tmp_path) -> None:
    project = tmp_path / "project"
    config_dir = project / "config"
    config_dir.mkdir(parents=True)
    config_path = config_dir / "pixypilot.yaml"
    config_path.write_text(
        """
frontend:
  dist: frontend/build
storage:
  presets: config/local-presets.yaml
  recordings: captures
""",
        encoding="utf-8",
    )

    assert config.frontend_dist_path(config_path) == project / "frontend" / "build"
    assert config.presets_path(config_path) == project / "config" / "local-presets.yaml"
    assert config.recordings_dir(config_path) == project / "captures"
