from pixypilot.domains.pixy_hid.service import PixyHidService


def test_report_gap_defaults_to_low_latency_value() -> None:
    service = PixyHidService()

    assert service.report_gap_seconds == 0.025


def test_report_gap_can_be_configured_with_yaml(tmp_path) -> None:
    config_path = tmp_path / "pixypilot.yaml"
    config_path.write_text(
        """
hid:
  report_gap_ms: 75
""",
        encoding="utf-8",
    )

    service = PixyHidService(config_path=config_path)

    assert service.report_gap_seconds == 0.075
