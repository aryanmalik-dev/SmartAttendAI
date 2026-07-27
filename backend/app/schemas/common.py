from datetime import date, datetime, time
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import AttendanceSource, AttendanceStatus, SessionStatus, UserRole
from app.schemas.auth import LoginUserOut


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)



class DepartmentIn(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    name: str
    description: str | None = None


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
    user: UserCreate
    student_number: str
    department_id: int
    enrollment_year: int
    phone: str | None = None
    guardian_email: EmailStr | None = None
    low_attendance_threshold: float = 75


class StudentOut(ORMModel):
    id: int
    student_number: str
    department_id: int
    enrollment_year: int
    phone: str | None
    guardian_email: EmailStr | None
    low_attendance_threshold: float
    user: LoginUserOut


class CourseIn(BaseModel):
    code: str
    name: str
    department_id: int
    faculty_id: int | None = None
    semester: str | None = None
    credits: int = 3
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
