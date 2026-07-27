from __future__ import annotations

from io import BytesIO

import pandas as pd
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import asc, desc


ALLOWED_IMPORT_EXTENSIONS = {".csv", ".xlsx"}


def _extension(filename: str) -> str:
    lowered = filename.lower()
    for ext in ALLOWED_IMPORT_EXTENSIONS:
        if lowered.endswith(ext):
            return ext
    return ""


def read_upload_dataframe(file: UploadFile) -> pd.DataFrame:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File name is required")

    ext = _extension(file.filename)
    if ext not in ALLOWED_IMPORT_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV and Excel files are supported")

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    buffer = BytesIO(content)
    if ext == ".csv":
        return pd.read_csv(buffer)

    return pd.read_excel(buffer)


def dataframe_to_csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode("utf-8")


def dataframe_to_excel_bytes(df: pd.DataFrame, sheet_name: str = "data") -> bytes:
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name=sheet_name, index=False)
    buffer.seek(0)
    return buffer.getvalue()


def template_csv_bytes(headers: list[str]) -> bytes:
    return dataframe_to_csv_bytes(pd.DataFrame(columns=headers))


def template_excel_bytes(headers: list[str], sheet_name: str = "template") -> bytes:
    return dataframe_to_excel_bytes(pd.DataFrame(columns=headers), sheet_name=sheet_name)


def apply_sort(stmt, model, sort: str | None, default_field: str):
    if not sort:
        return stmt.order_by(getattr(model, default_field).asc())

    field_name, _, direction = sort.partition(":")
    column = getattr(model, field_name, None)
    if column is None:
        return stmt.order_by(getattr(model, default_field).asc())
    if direction.lower() == "desc":
        return stmt.order_by(desc(column))
    return stmt.order_by(asc(column))
