from __future__ import annotations

from datetime import date

import pandas as pd
from fastapi import HTTPException, UploadFile
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.entities import Course, Department, FaceEmbedding, Faculty, Student, User, UserRoleAssignment
from app.models.enums import UserRole
from app.schemas.student import StudentCreate, StudentUpdate
from app.services.data_io import (
    dataframe_to_csv_bytes,
    dataframe_to_excel_bytes,
    read_upload_dataframe,
    template_csv_bytes,
    template_excel_bytes,
)


class StudentService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    def _student_email(self, admission_no: str) -> str:
        local_part = admission_no.strip().replace(" ", "")
        return f"{local_part}@{self.settings.student_email_domain}"

    def _get(self, student_id: int) -> Student:
        student = self.db.scalar(
            select(Student).options(selectinload(Student.user).selectinload(User.roles)).where(Student.id == student_id)
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        student.face_embedding_count = self.db.scalar(
            select(func.count(FaceEmbedding.id)).where(
                FaceEmbedding.student_id == student.id,
                FaceEmbedding.is_active.is_(True),
            )
        ) or 0
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
            raise HTTPException(status_code=400, detail="Student admission number already exists")

    def _validate_unique_roll_no(self, roll_no: str, exclude_id: int | None = None) -> None:
        if not roll_no or not roll_no.strip():
            raise HTTPException(status_code=400, detail="Roll number is required")
        stmt = select(Student).where(Student.roll_no == roll_no.strip())
        if exclude_id is not None:
            stmt = stmt.where(Student.id != exclude_id)
        if self.db.scalar(stmt):
            raise HTTPException(status_code=400, detail=f"Roll number '{roll_no}' already exists")

    def _validate_course(self, course_id: int) -> Course:
        course = self.db.get(Course, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        return course

    def _validate_department(self, department_id: int) -> Department:
        department = self.db.get(Department, department_id)
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        return department

    def _faculty_scope(self, user: User) -> tuple[Faculty, Department, Course]:
        faculty = self.db.scalar(
            select(Faculty)
            .options(selectinload(Faculty.department))
            .where(Faculty.user_id == user.id)
        )
        if not faculty:
            raise HTTPException(status_code=400, detail="Faculty profile not found for student import")
        if not faculty.department:
            raise HTTPException(status_code=400, detail="Faculty department is required for student import")
        course_id = faculty.department.course_id
        if course_id is None:
            raise HTTPException(status_code=400, detail="Faculty department is not linked to a course")
        course = self._validate_course(course_id)
        return faculty, faculty.department, course

    def create_student(self, data: StudentCreate) -> Student:
        self._validate_unique_student_number(data.admission_no)
        self._validate_unique_roll_no(data.roll_no)
        email = self._student_email(data.admission_no)
        self._validate_unique_email(email)
        department = self._validate_department(data.department_id)
        course = self._validate_course(data.course_id)
        if department.course_id != course.id:
            raise HTTPException(status_code=400, detail="Student department must belong to the selected course")

        user = User(
            email=email,
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
            student_number=data.admission_no,
            roll_no=data.roll_no,
            date_of_birth=data.date_of_birth,
            student_mobile=data.student_mobile,
            father_mobile=data.father_mobile,
            department_id=data.department_id,
            course_id=data.course_id,
            enrollment_year=data.enrollment_year,
            semester=data.semester,
            section=data.section,
            batch=data.batch,
            phone=data.student_mobile,
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
        if not sort:
            stmt = stmt.order_by(Student.roll_no.asc().nullslast(), Student.student_number.asc())
        else:
            field_name, _, direction = sort.partition(":")
            sort_map = {
                "admission_no": Student.student_number,
                "student_number": Student.student_number,
                "roll_no": Student.roll_no,
                "student": User.full_name,
                "full_name": User.full_name,
                "name": User.full_name,
            }
            column = sort_map.get(field_name, Student.roll_no)
            ordering = desc(column).nullslast() if direction.lower() == "desc" else asc(column).nullslast()
            stmt = stmt.order_by(ordering, Student.student_number.asc())
        total = self.db.scalar(count_stmt) or 0
        items = self.db.scalars(stmt.offset((page - 1) * size).limit(size)).all()
        if items:
            counts = dict(
                self.db.execute(
                    select(FaceEmbedding.student_id, func.count(FaceEmbedding.id))
                    .where(
                        FaceEmbedding.student_id.in_([item.id for item in items]),
                        FaceEmbedding.is_active.is_(True),
                    )
                    .group_by(FaceEmbedding.student_id)
                ).all()
            )
            for item in items:
                item.face_embedding_count = int(counts.get(item.id, 0) or 0)
        return items, total

    def get_student(self, student_id: int) -> Student:
        return self._get(student_id)

    def update_student(self, student_id: int, data: StudentUpdate) -> Student:
        student = self._get(student_id)
        values = data.model_dump(exclude_unset=True)
        if "full_name" in values:
            student.user.full_name = values.pop("full_name")
        if "student_mobile" in values:
            student.student_mobile = values["student_mobile"]
            student.phone = values["student_mobile"]
        if "roll_no" in values and values["roll_no"]:
            self._validate_unique_roll_no(values["roll_no"], exclude_id=student.id)
        for key, value in values.items():
            setattr(student, key, value)
        if "course_id" in values or "department_id" in values:
            department = self._validate_department(student.department_id)
            course = self._validate_course(student.course_id)
            if department.course_id != course.id:
                raise HTTPException(status_code=400, detail="Student department must belong to the selected course")
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
                    "admission_no": item.admission_no,
                    "full_name": item.user.full_name,
                    "student_number": item.student_number,
                    "roll_no": item.roll_no or "",
                    "date_of_birth": item.date_of_birth.isoformat() if item.date_of_birth else "",
                    "student_mobile": item.student_mobile or "",
                    "father_mobile": item.father_mobile or "",
                    "department_id": item.department_id,
                    "course_id": item.course_id,
                    "enrollment_year": item.enrollment_year,
                    "semester": item.semester,
                    "section": item.section,
                    "batch": item.batch,
                    "guardian_email": item.guardian_email or "",
                }
                for item in items
            ]
        )

    def export(self, file_format: str = "csv", **filters) -> bytes:
        df = self.export_rows(**filters)
        return dataframe_to_excel_bytes(df, "students") if file_format == "xlsx" else dataframe_to_csv_bytes(df)

    def template(self, file_format: str = "csv") -> bytes:
        headers = [
            "roll_no",
            "admission_no",
            "full_name",
            "batch",
            "date_of_birth",
            "student_mobile",
            "father_mobile",
            "enrollment_year",
            "semester",
            "section",
        ]
        return template_excel_bytes(headers, "students_template") if file_format == "xlsx" else template_csv_bytes(headers)

    def import_file(
        self,
        file: UploadFile,
        user: User,
        department_id: int | None = None,
        course_id: int | None = None,
    ) -> dict:
        df = read_upload_dataframe(file)
        required = [
            "admission_no",
            "roll_no",
            "full_name",
            "batch",
            "date_of_birth",
            "student_mobile",
            "father_mobile",
            "enrollment_year",
            "semester",
            "section",
        ]
        missing = [column for column in required if column not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")

        inserted = 0
        failed = 0
        errors: list[dict] = []
        seen_emails: set[str] = set()
        seen_numbers: set[str] = set()
        seen_roll_nos: set[str] = set()

        default_dept = None
        default_crs = None

        if department_id is not None and course_id is not None:
            default_dept = self._validate_department(department_id)
            default_crs = self._validate_course(course_id)
            if default_dept.course_id != default_crs.id:
                raise HTTPException(status_code=400, detail="Department does not belong to the selected course")
        else:
            try:
                _, default_dept, default_crs = self._faculty_scope(user)
            except Exception:
                pass

        def _clean(value: object) -> str:
            if pd.isna(value):
                return ""
            return str(value).strip()

        def _parse_optional_date(value: object) -> date | None:
            if pd.isna(value) or _clean(value) == "":
                return None
            parsed = pd.to_datetime(value, errors="coerce")
            if pd.isna(parsed):
                raise HTTPException(status_code=400, detail="Invalid date_of_birth")
            return parsed.date()

        for index, row in df.fillna("").iterrows():
            row_number = index + 2
            try:
                row_dept_id = _clean(row.get("department_id"))
                row_crs_id = _clean(row.get("course_id"))

                target_dept = default_dept
                target_crs = default_crs

                if row_dept_id:
                    target_dept = self._validate_department(int(row_dept_id))
                if row_crs_id:
                    target_crs = self._validate_course(int(row_crs_id))

                if not target_dept or not target_crs:
                    raise HTTPException(
                        status_code=400,
                        detail="Missing course/department context. Select a Course & Department in UI or provide 'course_id' and 'department_id' in Excel."
                    )

                data = StudentCreate.model_validate(
                    {
                        "admission_no": _clean(row.get("admission_no") or row.get("student_number")),
                        "roll_no": _clean(row.get("roll_no")),
                        "full_name": _clean(row["full_name"]),
                        "date_of_birth": _parse_optional_date(row.get("date_of_birth")),
                        "student_mobile": _clean(row.get("student_mobile") or row.get("phone")) or None,
                        "father_mobile": _clean(row.get("father_mobile")) or None,
                        "enrollment_year": int(row["enrollment_year"]),
                        "semester": int(row["semester"]),
                        "section": str(row["section"]).strip(),
                        "batch": str(row["batch"]).strip(),
                        "guardian_email": _clean(row.get("guardian_email")) or None,
                        "department_id": target_dept.id,
                        "course_id": target_crs.id,
                    }
                )
                email = self._student_email(data.admission_no)
                if email in seen_emails or data.admission_no in seen_numbers:
                    raise HTTPException(status_code=400, detail=f"Duplicate admission number '{data.admission_no}' in import file")
                if data.roll_no in seen_roll_nos:
                    raise HTTPException(status_code=400, detail=f"Duplicate roll number '{data.roll_no}' in import file")

                self._validate_unique_email(email)
                self._validate_unique_student_number(data.admission_no)
                self._validate_unique_roll_no(data.roll_no)

                new_user = User(
                    email=email,
                    full_name=data.full_name,
                    password_hash=None,
                    is_active=False,
                    email_verified=False,
                )
                self.db.add(new_user)
                self.db.flush()
                self.db.add(UserRoleAssignment(user_id=new_user.id, role=UserRole.STUDENT))
                self.db.add(
                    Student(
                        user_id=new_user.id,
                        student_number=data.admission_no,
                        roll_no=data.roll_no,
                        date_of_birth=data.date_of_birth,
                        student_mobile=data.student_mobile,
                        father_mobile=data.father_mobile,
                        department_id=department.id,
                        course_id=course.id,
                        enrollment_year=data.enrollment_year,
                        semester=data.semester,
                        section=data.section,
                        batch=data.batch,
                        phone=data.student_mobile,
                        guardian_email=data.guardian_email,
                    )
                )
                self.db.commit()
                inserted += 1
                seen_emails.add(email)
                seen_numbers.add(data.admission_no)
                seen_roll_nos.add(data.roll_no)
            except Exception as exc:  # noqa: BLE001
                self.db.rollback()
                failed += 1
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                errors.append({"row": row_number, "errors": [detail]})
        return {"inserted": inserted, "failed": failed, "errors": errors}
