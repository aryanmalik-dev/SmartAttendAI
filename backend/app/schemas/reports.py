from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ReportSummaryOut(BaseModel):
    scope: str
    total_records: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_percentage: float


class DailyReportOut(ReportSummaryOut):
    report_date: date
    sessions: int


class WeeklyReportOut(ReportSummaryOut):
    start_date: date
    end_date: date
    days: list[dict]


class MonthlyReportOut(ReportSummaryOut):
    month: str
    days: list[dict]


class AttendanceRecordReportOut(ORMModel):
    record_id: int
    session_id: int
    session_date: date
    start_time: time
    end_time: time | None
    student_id: int
    student_number: str
    student_name: str
    department_id: int
    department_name: str
    course_id: int
    course_abbreviation: str
    course_name: str
    subject_id: int
    subject_code: str
    subject_name: str
    faculty_id: int
    faculty_name: str
    status: str
    confidence: float | None
    source: str
    marked_at: datetime
    remarks: str | None


class StudentAttendanceSummaryOut(ORMModel):
    student_id: int
    student_number: str
    student_name: str
    department_id: int
    department_name: str
    course_id: int
    course_name: str
    semester: int
    section: str
    batch: str
    total_sessions: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_percentage: float


class EntityAttendanceSummaryOut(ORMModel):
    entity_id: int
    entity_name: str
    abbreviation: str | None = None
    total_records: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_percentage: float


class AttendanceReportFilters(BaseModel):
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)
    search: str | None = None
    sort: str | None = None
    department_id: int | None = None
    course_id: int | None = None
    subject_id: int | None = None
    faculty_id: int | None = None
    semester: int | None = None
    section: str | None = None
    batch: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    threshold: float = 75.0
