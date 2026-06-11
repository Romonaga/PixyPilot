import hashlib
import json
import re
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from pixypilot.config import project_root
from pixypilot.domains.pcap_import.models import PcapImportRecord

ALLOWED_CAPTURE_SUFFIXES = {".pcap", ".pcapng"}
MAX_LABEL_LENGTH = 180


class PcapImportService:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or project_root()

    async def save_capture(
        self,
        filename: str,
        chunks: AsyncIterator[bytes],
        action: str | None = None,
        notes: str | None = None,
        source: str = "windows",
    ) -> PcapImportRecord:
        original_filename = _clean_filename(filename)
        suffix = Path(original_filename).suffix.lower()
        if suffix not in ALLOWED_CAPTURE_SUFFIXES:
            raise ValueError("Only .pcap and .pcapng capture files are allowed")

        uploaded_at = datetime.now(UTC).replace(microsecond=0).isoformat()
        capture_id = uuid4().hex[:12]
        stored_filename = f"{uploaded_at.replace(':', '').replace('+0000', 'Z')}-{capture_id}-{original_filename}"
        output_dir = self.root / "pcaps" / "imports"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / stored_filename
        partial_path = output_path.with_suffix(output_path.suffix + ".part")
        digest = hashlib.sha256()
        size_bytes = 0

        try:
            with partial_path.open("wb") as handle:
                async for chunk in chunks:
                    if not chunk:
                        continue
                    size_bytes += len(chunk)
                    digest.update(chunk)
                    handle.write(chunk)
            if size_bytes == 0:
                raise ValueError("Capture upload was empty")
            partial_path.replace(output_path)
        except Exception:
            partial_path.unlink(missing_ok=True)
            raise

        record = PcapImportRecord(
            id=capture_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=str(output_path),
            size_bytes=size_bytes,
            sha256=digest.hexdigest(),
            uploaded_at=uploaded_at,
            action=_clean_label(action),
            notes=_clean_label(notes, max_length=2000),
            source=_clean_label(source) or "windows",
        )
        _metadata_path(output_path).write_text(json.dumps(record.model_dump(mode="json"), indent=2), encoding="utf-8")
        return record

    async def list_captures(self) -> list[PcapImportRecord]:
        output_dir = self.root / "pcaps" / "imports"
        if not output_dir.exists():
            return []

        records: list[PcapImportRecord] = []
        for metadata_path in sorted(output_dir.glob("*.json"), key=lambda path: path.name, reverse=True):
            try:
                records.append(PcapImportRecord(**json.loads(metadata_path.read_text(encoding="utf-8"))))
            except (OSError, json.JSONDecodeError, ValueError):
                continue
        return records


def _metadata_path(capture_path: Path) -> Path:
    return capture_path.with_suffix(capture_path.suffix + ".json")


def _clean_filename(filename: str) -> str:
    cleaned = Path(filename.strip().replace("\\", "/")).name
    cleaned = re.sub(r"[^A-Za-z0-9._ -]+", "_", cleaned).strip(" .")
    if not cleaned:
        raise ValueError("Capture filename is required")
    return cleaned[:160]


def _clean_label(value: str | None, max_length: int = MAX_LABEL_LENGTH) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned[:max_length] or None


def get_pcap_import_service() -> PcapImportService:
    return PcapImportService()
