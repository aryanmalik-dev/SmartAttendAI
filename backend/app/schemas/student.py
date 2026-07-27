from pydantic import BaseModel, ConfigDict, EmailStr


class StudentCreate(BaseModel):
    full_name: str
    email: EmailStr

    student_number: str

    department_id: int
    course_id: int

    enrollment_year: int
    semester: int

    section: str
    batch: str

    phone: str | None = None
    guardian_email: EmailStr | None = None


class StudentUpdate(BaseModel):
    full_name: str | None = None

    semester: int | None = None
    section: str | None = None
    batch: str | None = None

    phone: str | None = None
    guardian_email: EmailStr | None = None

    low_attendance_threshold: float | None = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr

    student_number: str

    department_id: int
    course_id: int

    semester: int
    section: str
    batch: str

    phone: str | None
    guardian_email: EmailStr | None