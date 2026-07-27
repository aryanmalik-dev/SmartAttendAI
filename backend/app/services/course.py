from __future__ import annotations

import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import Course, Department
from app.schemas.course import CourseCreate, CourseUpdate
from app.services.data_io import (
    apply_sort,
    dataframe_to_csv_bytes,
    dataframe_to_excel_bytes,
    read_upload_dataframe,
    template_csv_bytes,
    template_excel_bytes,
)


class CourseService:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, item_id: int) -> Course:
        item = self.db.get(Course, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Course not found")
        return item

    def _validate_department(self, department_id: int) -> None:
        if not self.db.get(Department, department_id):
            raise HTTPException(status_code=404, detail="Department not found")

    def _validate_unique(self, code: str, exclude_id: int | None = None) -> None:
        stmt = select(Course).where(Course.code == code)
        if exclude_id is not None:
            stmt = stmt.where(Course.id != exclude_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail="Course code already exists")

    def create(self, data: CourseCreate) -> Course:
        self._validate_department(data.department_id)
        self._validate_unique(data.code)
        item = Course(**data.model_dump())
        self.db.add(item)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Course code already exists") from exc
        self.db.refresh(item)
        return item

    def list(
        self,
        page: int,
        size: int,
        search: str | None = None,
        sort: str | None = None,
        department_id: int | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[Course], int]:
        stmt = select(Course)
        count_stmt = select(func.count()).select_from(Course)
        if search:
            criteria = or_(Course.code.ilike(f"%{search}%"), Course.name.ilike(f"%{search}%"), Course.abbreviation.ilike(f"%{search}%"))
            stmt = stmt.where(criteria)
            count_stmt = count_stmt.where(criteria)
        if department_id is not None:
            stmt = stmt.where(Course.department_id == department_id)
            count_stmt = count_stmt.where(Course.department_id == department_id)
        if is_active is not None:
            stmt = stmt.where(Course.is_active.is_(is_active))
            count_stmt = count_stmt.where(Course.is_active.is_(is_active))
        stmt = apply_sort(stmt, Course, sort, "code")
        total = self.db.scalar(count_stmt) or 0
        items = self.db.scalars(stmt.offset((page - 1) * size).limit(size)).all()
        return items, total

    def get(self, item_id: int) -> Course:
        return self._get(item_id)

    def update(self, item_id: int, data: CourseUpdate) -> Course:
        item = self._get(item_id)
        values = data.model_dump(exclude_unset=True)
        if "department_id" in values:
            self._validate_department(values["department_id"])
        if "code" in values:
            self._validate_unique(values["code"], exclude_id=item.id)
        for key, value in values.items():
            setattr(item, key, value)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Course code already exists") from exc
        self.db.refresh(item)
        return item

    def delete(self, item_id: int) -> None:
        item = self._get(item_id)
        try:
            self.db.delete(item)
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Course cannot be deleted while it is in use") from exc

    def export_rows(self, **filters) -> pd.DataFrame:
        items, _ = self.list(page=1, size=1000000, **filters)
        return pd.DataFrame(
            [
                {
                    "code": item.code,
                    "name": item.name,
                    "abbreviation": item.abbreviation,
                    "department_id": item.department_id,
                    "duration_years": item.duration_years,
                    "is_active": item.is_active,
                }
                for item in items
            ]
        )

    def export(self, file_format: str = "csv", **filters) -> bytes:
        df = self.export_rows(**filters)
        if file_format == "xlsx":
            return dataframe_to_excel_bytes(df, "courses")
        return dataframe_to_csv_bytes(df)

    def template(self, file_format: str = "csv") -> bytes:
        headers = ["code", "name", "abbreviation", "department_id", "duration_years", "is_active"]
        return template_excel_bytes(headers, "courses_template") if file_format == "xlsx" else template_csv_bytes(headers)

    def import_file(self, file: UploadFile) -> dict:
        df = read_upload_dataframe(file)
        required = ["code", "name", "abbreviation", "department_id", "duration_years", "is_active"]
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
                data = CourseCreate.model_validate(
                    {
                        "code": str(row["code"]).strip(),
                        "name": str(row["name"]).strip(),
                        "abbreviation": str(row["abbreviation"]).strip(),
                        "department_id": int(row["department_id"]),
                        "duration_years": int(row["duration_years"]),
                        "is_active": str(row["is_active"]).strip().lower() not in {"false", "0", "no"},
                    }
                )
                if data.code in seen or self.db.scalar(select(Course).where(Course.code == data.code)):
                    raise HTTPException(status_code=400, detail="Course code already exists")
                self._validate_department(data.department_id)
                self.db.add(Course(**data.model_dump()))
                self.db.commit()
                inserted += 1
                seen.add(data.code)
            except Exception as exc:  # noqa: BLE001
                self.db.rollback()
                failed += 1
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"row": row_number, "errors": [detail]})

        return {"inserted": inserted, "failed": failed, "errors": errors}
