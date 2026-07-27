from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SessionStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AttendanceSessionCreate(BaseModel):
    subject_assignment_id: int
    classroom_id: int
    session_date: date
    start_time: time
    end_time: time | None = None
    status: SessionStatus = SessionStatus.SCHEDULED
    notes: str | None = Field(default=None, max_length=2000)


class AttendanceSessionUpdate(BaseModel):
    subject_assignment_id: int | None = None
    classroom_id: int | None = None
    session_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    status: SessionStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)


class AttendanceSessionOut(AttendanceSessionCreate, ORMModel):
    id: int
