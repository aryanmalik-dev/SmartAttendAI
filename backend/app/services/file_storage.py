from __future__ import annotations

import re
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image

from app.core.config import get_settings

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
FORMAT_TO_EXTENSION = {
    "JPEG": ".jpg",
    "JPG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
    "BMP": ".bmp",
}


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    cleaned = re.sub(r"-+", "-", cleaned).strip("._-")
    return cleaned or "upload"


def _detect_extension(filename: str | None, content: bytes) -> str:
    if filename:
        suffix = Path(filename).suffix.lower()
        if suffix in ALLOWED_IMAGE_EXTENSIONS:
            return suffix if suffix != ".jpeg" else ".jpg"

    try:
        with Image.open(BytesIO(content)) as image:
            fmt = (image.format or "").upper()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must be a valid image") from exc

    extension = FORMAT_TO_EXTENSION.get(fmt)
    if extension is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image format")
    return extension


def build_face_upload_path(student_id: int, filename: str | None, content: bytes) -> Path:
    settings = get_settings()
    extension = _detect_extension(filename, content)
    stem = _slugify(Path(filename).stem if filename else "face")
    token = uuid.uuid4().hex
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    relative_path = Path("students") / str(student_id) / f"{timestamp}_{token}_{stem}{extension}"
    root = settings.face_upload_root
    return root / relative_path


def save_face_upload(student_id: int, file: UploadFile, content: bytes) -> str:
    target_path = build_face_upload_path(student_id, file.filename, content)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(content)
    settings = get_settings()
    return target_path.relative_to(settings.face_upload_root).as_posix()


def delete_face_upload(relative_path: str | None) -> None:
    if not relative_path:
        return
    settings = get_settings()
    target = settings.face_upload_root / Path(relative_path)
    if target.exists():
        target.unlink()
