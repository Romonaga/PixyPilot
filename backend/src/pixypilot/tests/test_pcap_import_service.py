import json

import pytest

from pixypilot.domains.pcap_import.service import PcapImportService


async def chunks(*parts: bytes):
    for part in parts:
        yield part


@pytest.mark.asyncio
async def test_save_capture_streams_file_and_metadata(tmp_path) -> None:
    service = PcapImportService(root=tmp_path)

    record = await service.save_capture(
        filename="Tracking Mode.pcapng",
        chunks=chunks(b"pcap", b" data"),
        action="Standard -> Tracking",
        notes="Changed one setting in EMEET Studio",
    )

    output_path = tmp_path / "pcaps" / "imports" / record.stored_filename
    metadata_path = output_path.with_suffix(output_path.suffix + ".json")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    assert output_path.read_bytes() == b"pcap data"
    assert record.original_filename == "Tracking Mode.pcapng"
    assert record.size_bytes == 9
    assert record.action == "Standard -> Tracking"
    assert metadata["sha256"] == record.sha256


@pytest.mark.asyncio
async def test_save_capture_rejects_unknown_extensions(tmp_path) -> None:
    service = PcapImportService(root=tmp_path)

    with pytest.raises(ValueError, match="Only .pcap and .pcapng"):
        await service.save_capture(filename="notes.txt", chunks=chunks(b"nope"))


@pytest.mark.asyncio
async def test_list_captures_uses_saved_metadata(tmp_path) -> None:
    service = PcapImportService(root=tmp_path)
    first = await service.save_capture(filename="first.pcapng", chunks=chunks(b"1"))
    second = await service.save_capture(filename="second.pcap", chunks=chunks(b"2"))

    records = await service.list_captures()

    assert {record.id for record in records} == {first.id, second.id}
