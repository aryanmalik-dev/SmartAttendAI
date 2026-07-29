from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StudentCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str
    admission_no: str = Field(alias="student_number")
    roll_no: str | None = None
    date_of_birth: date | None = None
    student_mobile: str | None = None
    father_mobile: str | None = None
    guardian_email: EmailStr | None = None

    department_id: int
    course_id: int

    enrollment_year: int
    semester: int

    section: str
    batch: str


class StudentUpdate(BaseModel):
    full_name: str | None = None

    roll_no: str | None = None
    date_of_birth: date | None = None
    student_mobile: str | None = None
    father_mobile: str | None = None
    guardian_email: EmailStr | None = None

    semester: int | None = None
    section: str | None = None
    batch: str | None = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admission_no: str
    student_number: str
    roll_no: str | None
    full_name: str
    email: EmailStr
    date_of_birth: date | None
    student_mobile: str | None
    father_mobile: str | None

    department_id: int
    course_id: int
    enrollment_year: int

    semester: int
    section: str
    batch: str

    guardian_email: EmailStr | None
    face_embedding_count: int = 0
