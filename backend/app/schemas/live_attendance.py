from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SessionStatus
from app.schemas.attendance_session import AttendanceSessionOut
from app.schemas.common import AttendanceRecordOut


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LiveAttendanceFrameIn(BaseModel):
    image_base64: str = Field(min_length=1)


class LiveFaceMatchOut(BaseModel):
    student_id: int | None = None
    student_name: str | None = None
    confidence: float
    bbox: list[int]
    status: str


class LiveAttendanceStatsOut(BaseModel):
    session_id: int
    session_status: SessionStatus
    total_faces: int
    recognized_faces: int
    unknown_faces: int
    duplicate_faces: int
    marked_records: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    total_students: int
    attendance_percentage: float


class LiveAttendanceFrameOut(LiveAttendanceStatsOut):
    marked: list[AttendanceRecordOut]
    matches: list[LiveFaceMatchOut]


class LiveAttendanceSessionStateOut(BaseModel):
    session: AttendanceSessionOut
    can_process: bool
    can_stop: bool
