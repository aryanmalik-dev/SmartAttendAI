from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.responses import ok, page
from app.db.session import get_db
from app.models.enums import UserRole
from app.schemas.notifications import NotificationHistoryOut, NotificationRetryIn, NotificationSendIn
from app.services.notifications import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))])


@router.get("")
def history(
    db: Session = Depends(get_db),
    p: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    channel: str | None = None,
    user_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    result = NotificationService(db).history_page(
        page=p,
        size=size,
        search=search,
        status=status,
        channel=channel,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
    )
    return page(result.items, result.total, p, size)


@router.get("/{notification_id}")
def get_notification(notification_id: int, db: Session = Depends(get_db)):
    return ok(NotificationService(db).get(notification_id), "Notification fetched")


@router.post("/send")
def send_notification(payload: NotificationSendIn, db: Session = Depends(get_db)):
    notification = NotificationService(db).send_generic(payload)
    return ok(NotificationService(db).get(notification.id), "Notification processed")


@router.post("/retry/{notification_id}")
def retry_notification(notification_id: int, payload: NotificationRetryIn, db: Session = Depends(get_db)):
    notification = NotificationService(db).retry(notification_id, payload.to_email)
    return ok(NotificationService(db).get(notification.id), "Notification resent")


@router.post("/low-attendance/{student_id}")
def low_attendance(student_id: int, db: Session = Depends(get_db)):
    notification = NotificationService(db).low_attendance_alert(student_id)
    return ok(NotificationService(db).get(notification.id), "Low attendance alert sent")


@router.post("/attendance-completed/{session_id}")
def attendance_completed(session_id: int, db: Session = Depends(get_db)):
    notification = NotificationService(db).attendance_completed_notification(session_id)
    return ok(NotificationService(db).get(notification.id), "Attendance completion notification sent")


@router.post("/absent/{student_id}/{session_id}")
def absent(student_id: int, session_id: int, db: Session = Depends(get_db)):
    notification = NotificationService(db).absent_notification(student_id, session_id)
    return ok(NotificationService(db).get(notification.id), "Absent notification sent")


@router.post("/parent/{student_id}")
def parent(student_id: int, message: str, db: Session = Depends(get_db)):
    notification = NotificationService(db).parent_notification(student_id, message)
    return ok(NotificationService(db).get(notification.id), "Parent notification sent")


@router.post("/faculty/{faculty_id}")
def faculty(faculty_id: int, subject: str, message: str, db: Session = Depends(get_db)):
    notification = NotificationService(db).send_faculty_alert(faculty_id, subject, message)
    return ok(NotificationService(db).get(notification.id), "Faculty notification sent")


@router.post("/admin/{user_id}")
def admin(user_id: int, subject: str, message: str, db: Session = Depends(get_db)):
    notification = NotificationService(db).send_admin_alert(user_id, subject, message)
    return ok(NotificationService(db).get(notification.id), "Admin notification sent")
