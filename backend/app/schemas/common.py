from datetime import date, datetime, time
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import AttendanceSource, AttendanceStatus, SessionStatus, UserRole
from app.schemas.auth import LoginUserOut


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)



class DepartmentIn(BaseModel):
    name: str
    abbreviation: str = Field(min_length=1, max_length=30)
    course_id: int
    description: str | None = None
    low_attendance_threshold: float = 75.0


class DepartmentOut(DepartmentIn, ORMModel):
    id: int


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=8)


class FacultyIn(BaseModel):
    user: UserCreate
    employee_id: str
    department_id: int
    designation: str | None = None
    phone: str | None = None


class FacultyOut(ORMModel):
    id: int
    employee_id: str
    department_id: int
    designation: str | None
    phone: str | None
    user: LoginUserOut


class StudentIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user: UserCreate
    admission_no: str = Field(alias="student_number")
    roll_no: str | None = None
    date_of_birth: date | None = None
    student_mobile: str | None = None
    father_mobile: str | None = None
    department_id: int
    course_id: int
    enrollment_year: int
    semester: int
    section: str
    batch: str
    guardian_email: EmailStr | None = None


class StudentOut(ORMModel):
    id: int
    admission_no: str
    student_number: str
    roll_no: str | None
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
    user: LoginUserOut


class CourseIn(BaseModel):
    name: str
    abbreviation: str
    duration_years: int = 4
    is_active: bool = True


class CourseOut(CourseIn, ORMModel):
    id: int


class ClassroomIn(BaseModel):
    name: str
    building: str
    capacity: int = Field(gt=0)
    camera_url: str | None = None


class ClassroomOut(ClassroomIn, ORMModel):
    id: int


class SessionIn(BaseModel):
    course_id: int
    faculty_id: int
    classroom_id: int
    session_date: date
    start_time: time
    end_time: time | None = None
    status: SessionStatus = SessionStatus.SCHEDULED
    notes: str | None = None


class SessionOut(SessionIn, ORMModel):
    id: int


class AttendanceRecordOut(ORMModel):
    id: int
    session_id: int
    student_id: int
    marked_by_id: int | None
    status: AttendanceStatus
    confidence: float | None
    source: AttendanceSource
    marked_at: datetime
    remarks: str | None


class ManualAttendanceIn(BaseModel):
    student_id: int
    status: AttendanceStatus
    remarks: str | None = None


class RecognitionIn(BaseModel):
    image_base64: str


class RecognitionOut(BaseModel):
    detected_students: int
    unknown_faces: int
    marked: list[AttendanceRecordOut]
    matches: list[dict]


class SettingsIn(BaseModel):
    key: str
    value: dict
    description: str | None = None
