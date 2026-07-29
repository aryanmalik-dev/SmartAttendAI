from __future__ import annotations

import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import Course, Department, Subject
from app.schemas.subject import SubjectCreate, SubjectUpdate
from app.services.data_io import (
    apply_sort,
    dataframe_to_csv_bytes,
    dataframe_to_excel_bytes,
    read_upload_dataframe,
    template_csv_bytes,
    template_excel_bytes,
)


class SubjectService:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, item_id: int) -> Subject:
        item = self.db.get(Subject, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Subject not found")
        return item

    def _validate_department(self, department_id: int) -> None:
        if not self.db.get(Department, department_id):
            raise HTTPException(status_code=404, detail="Department not found")

    def _validate_course(self, course_id: int) -> Course:
        course = self.db.get(Course, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        return course

    def _validate_unique(self, code: str, exclude_id: int | None = None) -> None:
        stmt = select(Subject).where(Subject.code == code)
        if exclude_id is not None:
            stmt = stmt.where(Subject.id != exclude_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail="Subject code already exists")

    def create(self, data: SubjectCreate) -> Subject:
        course = self._validate_course(data.course_id)
        department = self.db.get(Department, data.department_id)
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        if department.course_id != course.id:
            raise HTTPException(status_code=400, detail="Subject department must belong to the selected course")
        self._validate_unique(data.code)
        item = Subject(**data.model_dump())
        self.db.add(item)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Subject code already exists") from exc
        self.db.refresh(item)
        return item

    def list(
        self,
        page: int,
        size: int,
        search: str | None = None,
        sort: str | None = None,
        department_id: int | None = None,
        course_id: int | None = None,
        semester: int | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[Subject], int]:
        stmt = select(Subject)
        count_stmt = select(func.count()).select_from(Subject)
        if search:
            criteria = or_(Subject.code.ilike(f"%{search}%"), Subject.name.ilike(f"%{search}%"))
            stmt = stmt.where(criteria)
            count_stmt = count_stmt.where(criteria)
        if department_id is not None:
            stmt = stmt.where(Subject.department_id == department_id)
            count_stmt = count_stmt.where(Subject.department_id == department_id)
        if course_id is not None:
            stmt = stmt.where(Subject.course_id == course_id)
            count_stmt = count_stmt.where(Subject.course_id == course_id)
        if semester is not None:
            stmt = stmt.where(Subject.semester == semester)
            count_stmt = count_stmt.where(Subject.semester == semester)
        if is_active is not None:
            stmt = stmt.where(Subject.is_active.is_(is_active))
            count_stmt = count_stmt.where(Subject.is_active.is_(is_active))
        stmt = apply_sort(stmt, Subject, sort, "code")
        total = self.db.scalar(count_stmt) or 0
        items = self.db.scalars(stmt.offset((page - 1) * size).limit(size)).all()
        return items, total

    def get(self, item_id: int) -> Subject:
        return self._get(item_id)

    def update(self, item_id: int, data: SubjectUpdate) -> Subject:
        item = self._get(item_id)
        values = data.model_dump(exclude_unset=True)
        if "course_id" in values or "department_id" in values:
            course = self._validate_course(values.get("course_id", item.course_id))
            department_id = values.get("department_id", item.department_id)
            department = self.db.get(Department, department_id)
            if not department:
                raise HTTPException(status_code=404, detail="Department not found")
            if department.course_id != course.id:
                raise HTTPException(status_code=400, detail="Subject department must belong to the selected course")
        if "code" in values:
            self._validate_unique(values["code"], exclude_id=item.id)
        for key, value in values.items():
            setattr(item, key, value)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Subject code already exists") from exc
        self.db.refresh(item)
        return item

    def delete(self, item_id: int) -> None:
        item = self._get(item_id)
        try:
            self.db.delete(item)
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Subject cannot be deleted while it is in use") from exc

    def export_rows(self, **filters) -> pd.DataFrame:
        items, _ = self.list(page=1, size=1000000, **filters)
        return pd.DataFrame(
            [
                {
                    "code": item.code,
                    "name": item.name,
                    "course_id": item.course_id,
                    "department_id": item.department_id,
                    "semester": item.semester,
                    "credits": item.credits,
                    "is_active": item.is_active,
                }
                for item in items
            ]
        )

    def export(self, file_format: str = "csv", **filters) -> bytes:
        df = self.export_rows(**filters)
        return dataframe_to_excel_bytes(df, "subjects") if file_format == "xlsx" else dataframe_to_csv_bytes(df)

    def template(self, file_format: str = "csv") -> bytes:
        headers = ["code", "name", "course_id", "department_id", "semester", "credits", "is_active"]
        return template_excel_bytes(headers, "subjects_template") if file_format == "xlsx" else template_csv_bytes(headers)

    def import_file(self, file: UploadFile) -> dict:
        df = read_upload_dataframe(file)
        required = ["code", "name", "course_id", "department_id", "semester", "credits", "is_active"]
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
                data = SubjectCreate.model_validate(
                    {
                        "code": str(row["code"]).strip(),
                        "name": str(row["name"]).strip(),
                        "course_id": int(row["course_id"]),
                        "department_id": int(row["department_id"]),
                        "semester": int(row["semester"]),
                        "credits": int(row["credits"]),
                        "is_active": str(row["is_active"]).strip().lower() not in {"false", "0", "no"},
                    }
                )
                if data.code in seen or self.db.scalar(select(Subject).where(Subject.code == data.code)):
                    raise HTTPException(status_code=400, detail="Subject code already exists")
                course = self._validate_course(data.course_id)
                department = self.db.get(Department, data.department_id)
                if not department:
                    raise HTTPException(status_code=404, detail="Department not found")
                if department.course_id != course.id:
                    raise HTTPException(status_code=400, detail="Subject department must belong to the selected course")
                self.db.add(Subject(**data.model_dump()))
                self.db.commit()
                inserted += 1
                seen.add(data.code)
            except Exception as exc:  # noqa: BLE001
                self.db.rollback()
                failed += 1
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"row": row_number, "errors": [detail]})
        return {"inserted": inserted, "failed": failed, "errors": errors}
