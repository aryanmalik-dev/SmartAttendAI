from __future__ import annotations

import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import Faculty, Subject, SubjectAssignment
from app.schemas.subject_assignment import SubjectAssignmentCreate, SubjectAssignmentUpdate
from app.services.data_io import (
    apply_sort,
    dataframe_to_csv_bytes,
    dataframe_to_excel_bytes,
    read_upload_dataframe,
    template_csv_bytes,
    template_excel_bytes,
)


class SubjectAssignmentService:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, item_id: int) -> SubjectAssignment:
        item = self.db.get(SubjectAssignment, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Subject assignment not found")
        return item

    def _validate_faculty(self, faculty_id: int) -> Faculty:
        faculty = self.db.get(Faculty, faculty_id)
        if not faculty:
            raise HTTPException(status_code=404, detail="Faculty not found")
        return faculty

    def _validate_subject(self, subject_id: int) -> Subject:
        subject = self.db.get(Subject, subject_id)
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        return subject

    def _validate_unique(self, faculty_id: int, subject_id: int, section: str, academic_year: str, exclude_id: int | None = None) -> None:
        stmt = select(SubjectAssignment).where(
            SubjectAssignment.faculty_id == faculty_id,
            SubjectAssignment.subject_id == subject_id,
            SubjectAssignment.section == section,
            SubjectAssignment.academic_year == academic_year,
        )
        if exclude_id is not None:
            stmt = stmt.where(SubjectAssignment.id != exclude_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail="Subject assignment already exists")

    def create(self, data: SubjectAssignmentCreate) -> SubjectAssignment:
        faculty = self._validate_faculty(data.faculty_id)
        subject = self._validate_subject(data.subject_id)
        if faculty.department_id != subject.department_id:
            raise HTTPException(status_code=400, detail="Faculty and subject must belong to the same department")
        self._validate_unique(data.faculty_id, data.subject_id, data.section, data.academic_year)
        item = SubjectAssignment(**data.model_dump())
        self.db.add(item)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Subject assignment already exists") from exc
        self.db.refresh(item)
        return item

    def list(
        self,
        page: int,
        size: int,
        search: str | None = None,
        sort: str | None = None,
        faculty_id: int | None = None,
        subject_id: int | None = None,
        section: str | None = None,
        academic_year: str | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[SubjectAssignment], int]:
        stmt = select(SubjectAssignment)
        count_stmt = select(func.count()).select_from(SubjectAssignment)
        if search:
            criteria = or_(SubjectAssignment.section.ilike(f"%{search}%"), SubjectAssignment.academic_year.ilike(f"%{search}%"))
            stmt = stmt.where(criteria)
            count_stmt = count_stmt.where(criteria)
        if faculty_id is not None:
            stmt = stmt.where(SubjectAssignment.faculty_id == faculty_id)
            count_stmt = count_stmt.where(SubjectAssignment.faculty_id == faculty_id)
        if subject_id is not None:
            stmt = stmt.where(SubjectAssignment.subject_id == subject_id)
            count_stmt = count_stmt.where(SubjectAssignment.subject_id == subject_id)
        if section is not None:
            stmt = stmt.where(SubjectAssignment.section == section)
            count_stmt = count_stmt.where(SubjectAssignment.section == section)
        if academic_year is not None:
            stmt = stmt.where(SubjectAssignment.academic_year == academic_year)
            count_stmt = count_stmt.where(SubjectAssignment.academic_year == academic_year)
        if is_active is not None:
            stmt = stmt.where(SubjectAssignment.is_active.is_(is_active))
            count_stmt = count_stmt.where(SubjectAssignment.is_active.is_(is_active))
        stmt = apply_sort(stmt, SubjectAssignment, sort, "academic_year")
        total = self.db.scalar(count_stmt) or 0
        items = self.db.scalars(stmt.offset((page - 1) * size).limit(size)).all()
        return items, total

    def get(self, item_id: int) -> SubjectAssignment:
        return self._get(item_id)

    def update(self, item_id: int, data: SubjectAssignmentUpdate) -> SubjectAssignment:
        item = self._get(item_id)
        values = data.model_dump(exclude_unset=True)
        faculty_id = values.get("faculty_id", item.faculty_id)
        subject_id = values.get("subject_id", item.subject_id)
        section = values.get("section", item.section)
        academic_year = values.get("academic_year", item.academic_year)
        if "faculty_id" in values or "subject_id" in values:
            faculty = self._validate_faculty(faculty_id)
            subject = self._validate_subject(subject_id)
            if faculty.department_id != subject.department_id:
                raise HTTPException(status_code=400, detail="Faculty and subject must belong to the same department")
        if any(key in values for key in ("faculty_id", "subject_id", "section", "academic_year")):
            self._validate_unique(faculty_id, subject_id, section, academic_year, exclude_id=item.id)
        for key, value in values.items():
            setattr(item, key, value)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Subject assignment already exists") from exc
        self.db.refresh(item)
        return item

    def delete(self, item_id: int) -> None:
        item = self._get(item_id)
        try:
            self.db.delete(item)
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Subject assignment cannot be deleted while it is in use") from exc

    def export_rows(self, **filters) -> pd.DataFrame:
        items, _ = self.list(page=1, size=1000000, **filters)
        return pd.DataFrame(
            [
                {
                    "faculty_id": item.faculty_id,
                    "subject_id": item.subject_id,
                    "section": item.section,
                    "academic_year": item.academic_year,
                    "is_active": item.is_active,
                }
                for item in items
            ]
        )

    def export(self, file_format: str = "csv", **filters) -> bytes:
        df = self.export_rows(**filters)
        return dataframe_to_excel_bytes(df, "subject_assignments") if file_format == "xlsx" else dataframe_to_csv_bytes(df)

    def template(self, file_format: str = "csv") -> bytes:
        headers = ["faculty_id", "subject_id", "section", "academic_year", "is_active"]
        return template_excel_bytes(headers, "subject_assignments_template") if file_format == "xlsx" else template_csv_bytes(headers)

    def import_file(self, file: UploadFile) -> dict:
        df = read_upload_dataframe(file)
        required = ["faculty_id", "subject_id", "section", "academic_year", "is_active"]
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
                data = SubjectAssignmentCreate.model_validate(
                    {
                        "faculty_id": int(row["faculty_id"]),
                        "subject_id": int(row["subject_id"]),
                        "section": str(row["section"]).strip(),
                        "academic_year": str(row["academic_year"]).strip(),
                        "is_active": str(row["is_active"]).strip().lower() not in {"false", "0", "no"},
                    }
                )
                key = f"{data.faculty_id}:{data.subject_id}:{data.section}:{data.academic_year}"
                if key in seen or self.db.scalar(
                    select(SubjectAssignment).where(
                        SubjectAssignment.faculty_id == data.faculty_id,
                        SubjectAssignment.subject_id == data.subject_id,
                        SubjectAssignment.section == data.section,
                        SubjectAssignment.academic_year == data.academic_year,
                    )
                ):
                    raise HTTPException(status_code=400, detail="Subject assignment already exists")
                faculty = self._validate_faculty(data.faculty_id)
                subject = self._validate_subject(data.subject_id)
                if faculty.department_id != subject.department_id:
                    raise HTTPException(status_code=400, detail="Faculty and subject must belong to the same department")
                self.db.add(SubjectAssignment(**data.model_dump()))
                self.db.commit()
                inserted += 1
                seen.add(key)
            except Exception as exc:  # noqa: BLE001
                self.db.rollback()
                failed += 1
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"row": row_number, "errors": [detail]})
        return {"inserted": inserted, "failed": failed, "errors": errors}
