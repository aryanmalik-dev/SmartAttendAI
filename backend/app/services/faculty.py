from __future__ import annotations

import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.models.entities import Department, Faculty, User, UserRoleAssignment
from app.models.enums import UserRole
from app.schemas.faculty import FacultyCreate, FacultyUpdate
from app.services.data_io import (
    apply_sort,
    dataframe_to_csv_bytes,
    dataframe_to_excel_bytes,
    read_upload_dataframe,
    template_csv_bytes,
    template_excel_bytes,
)


class FacultyService:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, item_id: int) -> Faculty:
        item = self.db.scalar(
            select(Faculty).options(selectinload(Faculty.user).selectinload(User.roles)).where(Faculty.id == item_id)
        )
        if not item:
            raise HTTPException(status_code=404, detail="Faculty not found")
        return item

    def _validate_department(self, department_id: int) -> None:
        if not self.db.get(Department, department_id):
            raise HTTPException(status_code=404, detail="Department not found")

    def _validate_unique_employee(self, employee_id: str, exclude_id: int | None = None) -> None:
        stmt = select(Faculty).where(Faculty.employee_id == employee_id)
        if exclude_id is not None:
            stmt = stmt.where(Faculty.id != exclude_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail="Employee ID already exists")

    def _validate_unique_email(self, email: str, exclude_user_id: int | None = None) -> None:
        stmt = select(User).where(User.email == email)
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail="Email already exists")

    def create(self, data: FacultyCreate) -> Faculty:
        self._validate_department(data.department_id)
        self._validate_unique_employee(data.employee_id)
        self._validate_unique_email(data.user.email)
        user = User(
            email=data.user.email,
            full_name=data.user.full_name,
            password_hash=hash_password(data.user.password),
            is_active=True,
            email_verified=True,
        )
        self.db.add(user)
        self.db.flush()
        self.db.add(UserRoleAssignment(user_id=user.id, role=UserRole.FACULTY))
        item = Faculty(
            user_id=user.id,
            employee_id=data.employee_id,
            department_id=data.department_id,
            designation=data.designation,
            phone=data.phone,
        )
        self.db.add(item)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Faculty already exists") from exc
        self.db.refresh(item)
        return self._get(item.id)

    def list(
        self,
        page: int,
        size: int,
        search: str | None = None,
        sort: str | None = None,
        department_id: int | None = None,
    ) -> tuple[list[Faculty], int]:
        stmt = select(Faculty).options(selectinload(Faculty.user).selectinload(User.roles)).join(User)
        count_stmt = select(func.count()).select_from(Faculty).join(User)
        if search:
            criteria = or_(
                Faculty.employee_id.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
            stmt = stmt.where(criteria)
            count_stmt = count_stmt.where(criteria)
        if department_id is not None:
            stmt = stmt.where(Faculty.department_id == department_id)
            count_stmt = count_stmt.where(Faculty.department_id == department_id)
        stmt = apply_sort(stmt, Faculty, sort, "employee_id")
        total = self.db.scalar(count_stmt) or 0
        items = self.db.scalars(stmt.offset((page - 1) * size).limit(size)).all()
        return items, total

    def get(self, item_id: int) -> Faculty:
        return self._get(item_id)

    def update(self, item_id: int, data: FacultyUpdate) -> Faculty:
        item = self._get(item_id)
        values = data.model_dump(exclude_unset=True)
        if "department_id" in values:
            self._validate_department(values["department_id"])
        if "employee_id" in values:
            self._validate_unique_employee(values["employee_id"], exclude_id=item.id)
        if "email" in values:
            self._validate_unique_email(values["email"], exclude_user_id=item.user_id)
        if "full_name" in values:
            item.user.full_name = values.pop("full_name")
        if "email" in values:
            item.user.email = values.pop("email")
        if "password" in values and values["password"]:
            item.user.password_hash = hash_password(values.pop("password"))
        if "is_active" in values:
            item.user.is_active = values.pop("is_active")
        if "email_verified" in values:
            item.user.email_verified = values.pop("email_verified")
        for key, value in values.items():
            setattr(item, key, value)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Faculty already exists") from exc
        self.db.refresh(item)
        return self._get(item.id)

    def delete(self, item_id: int) -> None:
        item = self._get(item_id)
        try:
            self.db.delete(item.user)
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Faculty cannot be deleted while it is in use") from exc

    def export_rows(self, search: str | None = None, sort: str | None = None, department_id: int | None = None) -> pd.DataFrame:
        items, _ = self.list(page=1, size=1000000, search=search, sort=sort, department_id=department_id)
        return pd.DataFrame(
            [
                {
                    "email": item.user.email,
                    "full_name": item.user.full_name,
                    "employee_id": item.employee_id,
                    "department_id": item.department_id,
                    "designation": item.designation or "",
                    "phone": item.phone or "",
                }
                for item in items
            ]
        )

    def export(self, file_format: str = "csv", **filters) -> bytes:
        df = self.export_rows(**filters)
        return dataframe_to_excel_bytes(df, "faculty") if file_format == "xlsx" else dataframe_to_csv_bytes(df)

    def template(self, file_format: str = "csv") -> bytes:
        headers = ["email", "full_name", "password", "employee_id", "department_id", "designation", "phone"]
        return template_excel_bytes(headers, "faculty_template") if file_format == "xlsx" else template_csv_bytes(headers)

    def import_file(self, file: UploadFile) -> dict:
        df = read_upload_dataframe(file)
        required = ["email", "full_name", "password", "employee_id", "department_id", "designation", "phone"]
        missing = [column for column in required if column not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")

        inserted = 0
        failed = 0
        errors: list[dict] = []
        seen_emails: set[str] = set()
        seen_employee_ids: set[str] = set()
        for index, row in df.fillna("").iterrows():
            row_number = index + 2
            try:
                data = FacultyCreate.model_validate(
                    {
                        "user": {
                            "email": str(row["email"]).strip(),
                            "full_name": str(row["full_name"]).strip(),
                            "password": str(row["password"]).strip(),
                        },
                        "employee_id": str(row["employee_id"]).strip(),
                        "department_id": int(row["department_id"]),
                        "designation": str(row["designation"]).strip() or None,
                        "phone": str(row["phone"]).strip() or None,
                    }
                )
                if data.user.email in seen_emails or data.employee_id in seen_employee_ids:
                    raise HTTPException(status_code=400, detail="Faculty already exists")
                self._validate_department(data.department_id)
                self._validate_unique_email(data.user.email)
                self._validate_unique_employee(data.employee_id)
                user = User(
                    email=data.user.email,
                    full_name=data.user.full_name,
                    password_hash=hash_password(data.user.password),
                    is_active=True,
                    email_verified=True,
                )
                self.db.add(user)
                self.db.flush()
                self.db.add(UserRoleAssignment(user_id=user.id, role=UserRole.FACULTY))
                self.db.add(
                    Faculty(
                        user_id=user.id,
                        employee_id=data.employee_id,
                        department_id=data.department_id,
                        designation=data.designation,
                        phone=data.phone,
                    )
                )
                self.db.commit()
                inserted += 1
                seen_emails.add(data.user.email)
                seen_employee_ids.add(data.employee_id)
            except Exception as exc:  # noqa: BLE001
                self.db.rollback()
                failed += 1
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"row": row_number, "errors": [detail]})
        return {"inserted": inserted, "failed": failed, "errors": errors}
