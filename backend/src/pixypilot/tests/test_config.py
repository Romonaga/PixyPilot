from pixypilot import config


def test_backend_bind_defaults(monkeypatch) -> None:
    monkeypatch.delenv("PIXYPILOT_HOST", raising=False)
    monkeypatch.delenv("PIXYPILOT_PORT", raising=False)

    assert config.backend_host() == "127.0.0.1"
    assert config.backend_port() == 8000


def test_backend_bind_can_be_configured(monkeypatch) -> None:
    monkeypatch.setenv("PIXYPILOT_HOST", "0.0.0.0")
    monkeypatch.setenv("PIXYPILOT_PORT", "8010")

    assert config.backend_host() == "0.0.0.0"
    assert config.backend_port() == 8010


def test_cors_origins_follow_frontend_bind_settings(monkeypatch) -> None:
    monkeypatch.delenv("PIXYPILOT_CORS_ORIGINS", raising=False)
    monkeypatch.setenv("PIXYPILOT_FRONTEND_HOST", "0.0.0.0")
    monkeypatch.setenv("PIXYPILOT_FRONTEND_PORT", "5174")

    assert config.cors_origins() == ["http://0.0.0.0:5174"]


def test_cors_origins_can_be_configured_explicitly(monkeypatch) -> None:
    monkeypatch.setenv("PIXYPILOT_CORS_ORIGINS", "http://camera.local:5173, http://127.0.0.1:5173")

    assert config.cors_origins() == ["http://camera.local:5173", "http://127.0.0.1:5173"]


def test_frontend_dist_path_can_be_configured(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("PIXYPILOT_FRONTEND_DIST", str(tmp_path))

    assert config.frontend_dist_path() == tmp_path
