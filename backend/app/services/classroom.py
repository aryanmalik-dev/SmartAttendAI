from __future__ import annotations

import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import Classroom
from app.schemas.classroom import ClassroomCreate, ClassroomUpdate
from app.services.data_io import (
    apply_sort,
    dataframe_to_csv_bytes,
    dataframe_to_excel_bytes,
    read_upload_dataframe,
    template_csv_bytes,
    template_excel_bytes,
)


class ClassroomService:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, item_id: int) -> Classroom:
        item = self.db.get(Classroom, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Classroom not found")
        return item

    def _validate_unique(self, name: str, exclude_id: int | None = None) -> None:
        stmt = select(Classroom).where(Classroom.name == name)
        if exclude_id is not None:
            stmt = stmt.where(Classroom.id != exclude_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail="Classroom name already exists")

    def create(self, data: ClassroomCreate) -> Classroom:
        self._validate_unique(data.name)
        item = Classroom(**data.model_dump())
        self.db.add(item)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Classroom name already exists") from exc
        self.db.refresh(item)
        return item

    def list(
        self,
        page: int,
        size: int,
        search: str | None = None,
        sort: str | None = None,
    ) -> tuple[list[Classroom], int]:
        stmt = select(Classroom)
        count_stmt = select(func.count()).select_from(Classroom)
        if search:
            criteria = or_(Classroom.name.ilike(f"%{search}%"), Classroom.building.ilike(f"%{search}%"))
            stmt = stmt.where(criteria)
            count_stmt = count_stmt.where(criteria)
        stmt = apply_sort(stmt, Classroom, sort, "name")
        total = self.db.scalar(count_stmt) or 0
        items = self.db.scalars(stmt.offset((page - 1) * size).limit(size)).all()
        return items, total

    def get(self, item_id: int) -> Classroom:
        return self._get(item_id)

    def update(self, item_id: int, data: ClassroomUpdate) -> Classroom:
        item = self._get(item_id)
        values = data.model_dump(exclude_unset=True)
        if "name" in values:
            self._validate_unique(values["name"], exclude_id=item.id)
        for key, value in values.items():
            setattr(item, key, value)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Classroom name already exists") from exc
        self.db.refresh(item)
        return item

    def delete(self, item_id: int) -> None:
        item = self._get(item_id)
        try:
            self.db.delete(item)
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Classroom cannot be deleted while it is in use") from exc

    def export_rows(self, search: str | None = None, sort: str | None = None) -> pd.DataFrame:
        items, _ = self.list(page=1, size=1000000, search=search, sort=sort)
        return pd.DataFrame(
            [
                {
                    "name": item.name,
                    "building": item.building,
                    "capacity": item.capacity,
                    "camera_url": item.camera_url or "",
                }
                for item in items
            ]
        )

    def export(self, file_format: str = "csv", search: str | None = None, sort: str | None = None) -> bytes:
        df = self.export_rows(search=search, sort=sort)
        return dataframe_to_excel_bytes(df, "classrooms") if file_format == "xlsx" else dataframe_to_csv_bytes(df)

    def template(self, file_format: str = "csv") -> bytes:
        headers = ["name", "building", "capacity", "camera_url"]
        return template_excel_bytes(headers, "classrooms_template") if file_format == "xlsx" else template_csv_bytes(headers)

    def import_file(self, file: UploadFile) -> dict:
        df = read_upload_dataframe(file)
        required = ["name", "building", "capacity", "camera_url"]
        missing = [column for column in required if column not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")

        inserted = 0
        failed = 0
        errors: list[dict] = []
        seen: set[str] = set()
        for index, row in df.fillna("").iterrows():
            row_number = index + 2
            try:
                data = ClassroomCreate.model_validate(
                    {
                        "name": str(row["name"]).strip(),
                        "building": str(row["building"]).strip(),
                        "capacity": int(row["capacity"]),
                        "camera_url": str(row["camera_url"]).strip() or None,
                    }
                )
                if data.name in seen or self.db.scalar(select(Classroom).where(Classroom.name == data.name)):
                    raise HTTPException(status_code=400, detail="Classroom name already exists")
                self.db.add(Classroom(**data.model_dump()))
                self.db.commit()
                inserted += 1
                seen.add(data.name)
            except Exception as exc:  # noqa: BLE001
                self.db.rollback()
                failed += 1
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"row": row_number, "errors": [detail]})
        return {"inserted": inserted, "failed": failed, "errors": errors}
