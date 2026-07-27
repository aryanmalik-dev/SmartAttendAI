from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.responses import ok
from app.db.session import get_db
from app.models.entities import User
from app.models.enums import UserRole
from app.schemas.attendance_session import AttendanceSessionOut
from app.schemas.live_attendance import LiveAttendanceFrameIn, LiveAttendanceFrameOut, LiveAttendanceSessionStateOut, LiveAttendanceStatsOut
from app.services.live_attendance import LiveAttendanceService

router = APIRouter(prefix="/live-attendance", tags=["live-attendance"], dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))])


@router.post("/sessions/{session_id}/start", summary="Start live attendance")
def start_session(
    session_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    session = LiveAttendanceService(db).start(session_id, user)
    return ok(AttendanceSessionOut.model_validate(session).model_dump(mode="json"), "Attendance session started")


@router.post("/sessions/{session_id}/stop", summary="Stop live attendance")
def stop_session(
    session_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    session = LiveAttendanceService(db).stop(session_id, user)
    return ok(AttendanceSessionOut.model_validate(session).model_dump(mode="json"), "Attendance session stopped")


@router.get("/sessions/{session_id}/state", summary="Get live attendance state")
def session_state(
    session_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    state = LiveAttendanceService(db).state(session_id, user)
    return ok(LiveAttendanceSessionStateOut.model_validate(state).model_dump(mode="json"), "Attendance session state")


@router.get("/sessions/{session_id}/stats", summary="Get live attendance stats")
def session_stats(
    session_id: int,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    stats = LiveAttendanceService(db).stats(session_id, user)
    return ok(LiveAttendanceStatsOut.model_validate(stats).model_dump(mode="json"), "Attendance session stats")


@router.post("/sessions/{session_id}/frame", summary="Process a camera frame")
def process_frame(
    session_id: int,
    payload: LiveAttendanceFrameIn,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    result = LiveAttendanceService(db).process_frame(session_id, user, payload)
    return ok(LiveAttendanceFrameOut.model_validate(result).model_dump(mode="json"), "Frame processed")
