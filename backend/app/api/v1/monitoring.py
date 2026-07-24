from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.responses import ok
from app.db.session import get_db
from app.models.entities import AttendanceSession
from app.models.enums import UserRole

router = APIRouter(prefix="/monitoring", tags=["monitoring"], dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))])


@router.get("/sessions/{session_id}")
def live_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(AttendanceSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    present = len(session.records)
    started = datetime.combine(session.session_date, session.start_time).replace(tzinfo=timezone.utc)
    duration = max(0, int((datetime.now(timezone.utc) - started).total_seconds()))
    avg_confidence = round(sum((r.confidence or 0) for r in session.records) / max(present, 1), 3)
    return ok({
        "session_id": session.id,
        "course_id": session.course_id,
        "classroom_id": session.classroom_id,
        "status": session.status.value,
        "detected_students": present,
        "unknown_faces": 0,
        "live_attendance_count": present,
        "session_duration_seconds": duration,
        "average_confidence": avg_confidence,
    })
