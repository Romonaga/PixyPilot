from pydantic import BaseModel


class PcapImportRecord(BaseModel):
    id: str
    original_filename: str
    stored_filename: str
    file_path: str
    size_bytes: int
    sha256: str
    uploaded_at: str
    action: str | None = None
    notes: str | None = None
    source: str = "windows"


class PcapImportList(BaseModel):
    captures: list[PcapImportRecord]
