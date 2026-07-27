from __future__ import annotations

from io import BytesIO

import pandas as pd
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import Department
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.services.data_io import (
    apply_sort,
    dataframe_to_csv_bytes,
    dataframe_to_excel_bytes,
    read_upload_dataframe,
    template_csv_bytes,
    template_excel_bytes,
)


class DepartmentService:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, item_id: int) -> Department:
        item = self.db.get(Department, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Department not found")
        return item

    def _validate_unique(self, code: str | None = None, name: str | None = None, exclude_id: int | None = None) -> None:
        stmt = select(Department)
        clauses = []
        if code is not None:
            clauses.append(Department.code == code)
        if name is not None:
            clauses.append(Department.name == name)
        if not clauses:
            return
        stmt = stmt.where(or_(*clauses))
        if exclude_id is not None:
            stmt = stmt.where(Department.id != exclude_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail="Department code or name already exists")

    def create(self, data: DepartmentCreate) -> Department:
        self._validate_unique(data.code, data.name)
        item = Department(**data.model_dump())
        self.db.add(item)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Department code or name already exists") from exc
        self.db.refresh(item)
        return item

    def list(
        self,
        page: int,
        size: int,
        search: str | None = None,
        sort: str | None = None,
    ) -> tuple[list[Department], int]:
        stmt = select(Department)
        count_stmt = select(func.count()).select_from(Department)
        if search:
            criteria = or_(
                Department.code.ilike(f"%{search}%"),
                Department.name.ilike(f"%{search}%"),
                Department.description.ilike(f"%{search}%"),
            )
            stmt = stmt.where(criteria)
            count_stmt = count_stmt.where(criteria)
        stmt = apply_sort(stmt, Department, sort, "code")
        total = self.db.scalar(count_stmt) or 0
        items = self.db.scalars(stmt.offset((page - 1) * size).limit(size)).all()
        return items, total

    def get(self, item_id: int) -> Department:
        return self._get(item_id)

    def update(self, item_id: int, data: DepartmentUpdate) -> Department:
        item = self._get(item_id)
        values = data.model_dump(exclude_unset=True)
        if "code" in values or "name" in values:
            self._validate_unique(values.get("code", item.code), values.get("name", item.name), exclude_id=item.id)
        for key, value in values.items():
            setattr(item, key, value)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Department code or name already exists") from exc
        self.db.refresh(item)
        return item

    def delete(self, item_id: int) -> None:
        item = self._get(item_id)
        try:
            self.db.delete(item)
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Department cannot be deleted while it is in use") from exc

    def export_rows(self, search: str | None = None, sort: str | None = None) -> pd.DataFrame:
        items, _ = self.list(page=1, size=1000000, search=search, sort=sort)
        return pd.DataFrame(
            [
                {
                    "code": item.code,
                    "name": item.name,
                    "description": item.description or "",
                }
                for item in items
            ]
        )

    def export(self, file_format: str = "csv", search: str | None = None, sort: str | None = None) -> bytes:
        df = self.export_rows(search=search, sort=sort)
        if file_format == "xlsx":
            return dataframe_to_excel_bytes(df, "departments")
        return dataframe_to_csv_bytes(df)

    def template(self, file_format: str = "csv") -> bytes:
        headers = ["code", "name", "description"]
        if file_format == "xlsx":
            return template_excel_bytes(headers, "departments_template")
        return template_csv_bytes(headers)

    def import_file(self, file: UploadFile) -> dict:
        df = read_upload_dataframe(file)
        required = ["code", "name", "description"]
        missing = [column for column in required if column not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")

        inserted = 0
        failed = 0
        errors: list[dict] = []
        seen: set[str] = set()

        for index, row in df.fillna("").iterrows():
            row_number = index + 2
            payload = {
                "code": str(row["code"]).strip(),
                "name": str(row["name"]).strip(),
                "description": str(row["description"]).strip() or None,
            }
            try:
                data = DepartmentCreate.model_validate(payload)
                if data.code in seen or self.db.scalar(select(Department).where(Department.code == data.code)) or self.db.scalar(select(Department).where(Department.name == data.name)):
                    raise HTTPException(status_code=400, detail="Department code or name already exists")
                self.db.add(Department(**data.model_dump()))
                self.db.commit()
                inserted += 1
                seen.add(data.code)
            except Exception as exc:  # noqa: BLE001
                self.db.rollback()
                failed += 1
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"row": row_number, "errors": [detail]})

        return {"inserted": inserted, "failed": failed, "errors": errors}
