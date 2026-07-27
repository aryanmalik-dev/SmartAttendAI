from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import AttendanceSession, Classroom, SubjectAssignment
from app.schemas.attendance_session import AttendanceSessionCreate, AttendanceSessionUpdate


class AttendanceSessionService:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, item_id: int) -> AttendanceSession:
        item = self.db.get(AttendanceSession, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Attendance session not found")
        return item

    def _validate_subject_assignment(self, subject_assignment_id: int) -> None:
        if not self.db.get(SubjectAssignment, subject_assignment_id):
            raise HTTPException(status_code=404, detail="Subject assignment not found")

    def _validate_classroom(self, classroom_id: int) -> None:
        if not self.db.get(Classroom, classroom_id):
            raise HTTPException(status_code=404, detail="Classroom not found")

    def create(self, data: AttendanceSessionCreate) -> AttendanceSession:
        self._validate_subject_assignment(data.subject_assignment_id)
        self._validate_classroom(data.classroom_id)
        item = AttendanceSession(**data.model_dump())
        self.db.add(item)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Attendance session could not be created") from exc
        self.db.refresh(item)
        return item

    def list(self, page: int, size: int, search: str | None = None) -> tuple[list[AttendanceSession], int]:
        stmt = select(AttendanceSession).order_by(AttendanceSession.session_date.desc(), AttendanceSession.start_time.desc())
        count_stmt = select(func.count()).select_from(AttendanceSession)
        if search:
            criteria = AttendanceSession.notes.ilike(f"%{search}%")
            stmt = stmt.where(criteria)
            count_stmt = count_stmt.where(criteria)
        total = self.db.scalar(count_stmt) or 0
        items = self.db.scalars(stmt.offset((page - 1) * size).limit(size)).all()
        return items, total

    def get(self, item_id: int) -> AttendanceSession:
        return self._get(item_id)

    def update(self, item_id: int, data: AttendanceSessionUpdate) -> AttendanceSession:
        item = self._get(item_id)
        values = data.model_dump(exclude_unset=True)
        if "subject_assignment_id" in values:
            self._validate_subject_assignment(values["subject_assignment_id"])
        if "classroom_id" in values:
            self._validate_classroom(values["classroom_id"])
        for key, value in values.items():
            setattr(item, key, value)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Attendance session could not be updated") from exc
        self.db.refresh(item)
        return item

    def delete(self, item_id: int) -> None:
        item = self._get(item_id)
        try:
            self.db.delete(item)
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(status_code=409, detail="Attendance session cannot be deleted while it is in use") from exc
