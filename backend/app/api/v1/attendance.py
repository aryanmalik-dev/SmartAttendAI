from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.responses import ok, page
from app.db.session import get_db
from app.models.entities import AttendanceRecord, AttendanceSession, User
from app.models.enums import UserRole
from app.schemas.attendance_session import AttendanceSessionCreate, AttendanceSessionOut, AttendanceSessionUpdate
from app.schemas.common import AttendanceRecordOut, ManualAttendanceIn, RecognitionIn, RecognitionOut
from app.services.attendance_session import AttendanceSessionService
from app.services.attendance import mark_manual, recognize_and_mark
from app.services.face import decode_base64_image, get_face_provider

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("/sessions")
def list_sessions(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
    p: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    items, total = AttendanceSessionService(db).list(p, size, search, current_user=current_user)
    return page([AttendanceSessionOut.model_validate(item).model_dump(mode="json") for item in items], total, p, size)


@router.post("/sessions")
def create_session(
    payload: AttendanceSessionCreate,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = AttendanceSessionService(db).create(payload)
    return ok(AttendanceSessionOut.model_validate(item).model_dump(mode="json"), "Attendance session created")


@router.get("/sessions/{session_id}")
def get_session(
    session_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = AttendanceSessionService(db).get(session_id)
    return ok(AttendanceSessionOut.model_validate(item).model_dump(mode="json"))


@router.patch("/sessions/{session_id}")
def update_session(
    session_id: int,
    payload: AttendanceSessionUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = AttendanceSessionService(db).update(session_id, payload)
    return ok(AttendanceSessionOut.model_validate(item).model_dump(mode="json"), "Attendance session updated")


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    AttendanceSessionService(db).delete(session_id)
    return ok(message="Attendance session deleted")


@router.post("/sessions/{session_id}/recognize")
def recognize(session_id: int, payload: RecognitionIn, user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db)):
    try:
        result = recognize_and_mark(db, session_id, user.id, decode_base64_image(payload.image_base64), get_face_provider())
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    result["marked"] = [AttendanceRecordOut.model_validate(record).model_dump(mode="json") for record in result["marked"]]
    return ok(RecognitionOut(**result).model_dump(mode="json"), "Recognition processed")


@router.post("/sessions/{session_id}/manual")
def manual(session_id: int, payload: ManualAttendanceIn, user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db)):
    record = mark_manual(db, session_id, payload.student_id, user.id, payload.status, payload.remarks)
    return ok(AttendanceRecordOut.model_validate(record).model_dump(mode="json"), "Attendance corrected")


@router.get("/records")
def records(db: Session = Depends(get_db), p: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), session_id: int | None = None, student_id: int | None = None):
    stmt = select(AttendanceRecord).order_by(AttendanceRecord.marked_at.desc())
    if session_id:
        stmt = stmt.where(AttendanceRecord.session_id == session_id)
    if student_id:
        stmt = stmt.where(AttendanceRecord.student_id == student_id)
    total = len(db.scalars(stmt).all())
    items = db.scalars(stmt.offset((p - 1) * size).limit(size)).all()
    return page([AttendanceRecordOut.model_validate(i).model_dump(mode="json") for i in items], total, p, size)
