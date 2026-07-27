from __future__ import annotations

import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.models.entities import Course, Student, User, UserRoleAssignment
from app.models.enums import UserRole
from app.schemas.student import StudentCreate, StudentUpdate
from app.services.data_io import (
    apply_sort,
    dataframe_to_csv_bytes,
    dataframe_to_excel_bytes,
    read_upload_dataframe,
    template_csv_bytes,
    template_excel_bytes,
)


class StudentService:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, student_id: int) -> Student:
        student = self.db.scalar(
            select(Student).options(selectinload(Student.user).selectinload(User.roles)).where(Student.id == student_id)
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        return student

    def _validate_unique_email(self, email: str, exclude_user_id: int | None = None) -> None:
        stmt = select(User).where(User.email == email)
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail="Email already exists")

    def _validate_unique_student_number(self, student_number: str, exclude_id: int | None = None) -> None:
        stmt = select(Student).where(Student.student_number == student_number)
        if exclude_id is not None:
            stmt = stmt.where(Student.id != exclude_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail="Student number already exists")

    def _validate_course(self, course_id: int) -> Course:
        course = self.db.get(Course, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        return course

    def create_student(self, data: StudentCreate) -> Student:
        self._validate_unique_email(data.email)
        self._validate_unique_student_number(data.student_number)
        course = self._validate_course(data.course_id)
        if course.department_id != data.department_id:
            raise HTTPException(status_code=400, detail="Student department must match course department")

        user = User(
            email=data.email,
            full_name=data.full_name,
            password_hash=None,
            is_active=False,
            email_verified=False,
        )
        self.db.add(user)
        self.db.flush()
        self.db.add(UserRoleAssignment(user_id=user.id, role=UserRole.STUDENT))
        student = Student(
            user_id=user.id,
            student_number=data.student_number,
            department_id=data.department_id,
            course_id=data.course_id,
            enrollment_year=data.enrollment_year,
            semester=data.semester,
            section=data.section,
            batch=data.batch,
            phone=data.phone,
            guardian_email=data.guardian_email,
        )
        self.db.add(student)
        self.db.commit()
        self.db.refresh(student)
        return self._get(student.id)

    def list_students(
        self,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        sort: str | None = None,
        department_id: int | None = None,
        course_id: int | None = None,
        semester: int | None = None,
        section: str | None = None,
        batch: str | None = None,
    ) -> tuple[list[Student], int]:
        stmt = select(Student).options(selectinload(Student.user).selectinload(User.roles)).join(User)
        count_stmt = select(func.count()).select_from(Student).join(User)
        if search:
            criteria = or_(
                Student.student_number.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
            stmt = stmt.where(criteria)
            count_stmt = count_stmt.where(criteria)
        if department_id is not None:
            stmt = stmt.where(Student.department_id == department_id)
            count_stmt = count_stmt.where(Student.department_id == department_id)
        if course_id is not None:
            stmt = stmt.where(Student.course_id == course_id)
            count_stmt = count_stmt.where(Student.course_id == course_id)
        if semester is not None:
            stmt = stmt.where(Student.semester == semester)
            count_stmt = count_stmt.where(Student.semester == semester)
        if section is not None:
            stmt = stmt.where(Student.section == section)
            count_stmt = count_stmt.where(Student.section == section)
        if batch is not None:
            stmt = stmt.where(Student.batch == batch)
            count_stmt = count_stmt.where(Student.batch == batch)
        stmt = apply_sort(stmt, Student, sort, "student_number")
        total = self.db.scalar(count_stmt) or 0
        items = self.db.scalars(stmt.offset((page - 1) * size).limit(size)).all()
        return items, total

    def get_student(self, student_id: int) -> Student:
        return self._get(student_id)

    def update_student(self, student_id: int, data: StudentUpdate) -> Student:
        student = self._get(student_id)
        values = data.model_dump(exclude_unset=True)
        if "full_name" in values:
            student.user.full_name = values.pop("full_name")
        if "low_attendance_threshold" in values:
            student.low_attendance_threshold = values.pop("low_attendance_threshold")
        for key, value in values.items():
            setattr(student, key, value)
        if "course_id" in values or "department_id" in values:
            course = self._validate_course(student.course_id)
            if course.department_id != student.department_id:
                raise HTTPException(status_code=400, detail="Student department must match course department")
        self.db.commit()
        self.db.refresh(student)
        return self._get(student.id)

    def delete_student(self, student_id: int) -> None:
        student = self._get(student_id)
        self.db.delete(student.user)
        self.db.commit()

    def export_rows(self, **filters) -> pd.DataFrame:
        items, _ = self.list_students(page=1, size=1000000, **filters)
        return pd.DataFrame(
            [
                {
                    "email": item.user.email,
                    "full_name": item.user.full_name,
                    "student_number": item.student_number,
                    "department_id": item.department_id,
                    "course_id": item.course_id,
                    "enrollment_year": item.enrollment_year,
                    "semester": item.semester,
                    "section": item.section,
                    "batch": item.batch,
                    "phone": item.phone or "",
                    "guardian_email": item.guardian_email or "",
                    "low_attendance_threshold": item.low_attendance_threshold,
                }
                for item in items
            ]
        )

    def export(self, file_format: str = "csv", **filters) -> bytes:
        df = self.export_rows(**filters)
        return dataframe_to_excel_bytes(df, "students") if file_format == "xlsx" else dataframe_to_csv_bytes(df)

    def template(self, file_format: str = "csv") -> bytes:
        headers = [
            "email",
            "full_name",
            "password",
            "student_number",
            "department_id",
            "course_id",
            "enrollment_year",
            "semester",
            "section",
            "batch",
            "phone",
            "guardian_email",
            "low_attendance_threshold",
        ]
        return template_excel_bytes(headers, "students_template") if file_format == "xlsx" else template_csv_bytes(headers)

    def import_file(self, file: UploadFile) -> dict:
        df = read_upload_dataframe(file)
        required = [
            "email",
            "full_name",
            "password",
            "student_number",
            "department_id",
            "course_id",
            "enrollment_year",
            "semester",
            "section",
            "batch",
            "phone",
            "guardian_email",
            "low_attendance_threshold",
        ]
        missing = [column for column in required if column not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")

        inserted = 0
        failed = 0
        errors: list[dict] = []
        seen_emails: set[str] = set()
        seen_numbers: set[str] = set()
        for index, row in df.fillna("").iterrows():
            row_number = index + 2
            try:
                data = StudentCreate.model_validate(
                    {
                        "email": str(row["email"]).strip(),
                        "full_name": str(row["full_name"]).strip(),
                        "password": str(row["password"]).strip(),
                        "student_number": str(row["student_number"]).strip(),
                        "department_id": int(row["department_id"]),
                        "course_id": int(row["course_id"]),
                        "enrollment_year": int(row["enrollment_year"]),
                        "semester": int(row["semester"]),
                        "section": str(row["section"]).strip(),
                        "batch": str(row["batch"]).strip(),
                        "phone": str(row["phone"]).strip() or None,
                        "guardian_email": str(row["guardian_email"]).strip() or None,
                    }
                )
                if data.email in seen_emails or data.student_number in seen_numbers:
                    raise HTTPException(status_code=400, detail="Duplicate student")
                self._validate_unique_email(data.email)
                self._validate_unique_student_number(data.student_number)
                course = self._validate_course(data.course_id)
                if course.department_id != data.department_id:
                    raise HTTPException(status_code=400, detail="Student department must match course department")
                user = User(
                    email=data.email,
                    full_name=data.full_name,
                    password_hash=None,
                    is_active=False,
                    email_verified=False,
                )
                self.db.add(user)
                self.db.flush()
                self.db.add(UserRoleAssignment(user_id=user.id, role=UserRole.STUDENT))
                self.db.add(
                    Student(
                        user_id=user.id,
                        student_number=data.student_number,
                        department_id=data.department_id,
                        course_id=data.course_id,
                        enrollment_year=data.enrollment_year,
                        semester=data.semester,
                        section=data.section,
                        batch=data.batch,
                        phone=data.phone,
                        guardian_email=data.guardian_email,
                    )
                )
                self.db.commit()
                inserted += 1
                seen_emails.add(data.email)
                seen_numbers.add(data.student_number)
            except Exception as exc:  # noqa: BLE001
                self.db.rollback()
                failed += 1
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"row": row_number, "errors": [detail]})
        return {"inserted": inserted, "failed": failed, "errors": errors}
