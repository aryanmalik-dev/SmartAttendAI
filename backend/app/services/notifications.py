from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.models.entities import AttendanceSession, Faculty, Notification, Student, User
from app.models.enums import NotificationStatus, SessionStatus
from app.schemas.notifications import NotificationHistoryOut, NotificationOut, NotificationSendIn
from app.services.email import send_email


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def _user_or_404(self, user_id: int) -> User:
        user = self.db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    def _student_or_404(self, student_id: int) -> Student:
        student = self.db.get(Student, student_id)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        return student

    def _faculty_or_404(self, faculty_id: int) -> Faculty:
        faculty = self.db.get(Faculty, faculty_id)
        if not faculty:
            raise HTTPException(status_code=404, detail="Faculty not found")
        return faculty

    def _session_or_404(self, session_id: int) -> AttendanceSession:
        session = self.db.get(AttendanceSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Attendance session not found")
        return session

    def send_generic(self, payload: NotificationSendIn) -> Notification:
        return send_email(self.db, payload.to_email, payload.subject, payload.message, payload.user_id)

    def send_student_alert(self, student_id: int, subject: str, message: str) -> Notification:
        student = self._student_or_404(student_id)
        recipient = student.guardian_email or student.user.email
        return send_email(self.db, recipient, subject, message, student.user_id)

    def send_faculty_alert(self, faculty_id: int, subject: str, message: str) -> Notification:
        faculty = self._faculty_or_404(faculty_id)
        return send_email(self.db, faculty.user.email, subject, message, faculty.user_id)

    def send_admin_alert(self, user_id: int, subject: str, message: str) -> Notification:
        user = self._user_or_404(user_id)
        return send_email(self.db, user.email, subject, message, user.id)

    def low_attendance_alert(self, student_id: int) -> Notification:
        student = self._student_or_404(student_id)
        subject = "Low attendance alert"
        threshold = student.department.low_attendance_threshold if student.department else 75.0
        message = (
            f"Student {student.user.full_name} ({student.student_number}) has low attendance.\n"
            f"Current threshold: {threshold}%."
        )
        return self.send_student_alert(student_id, subject, message)

    def attendance_completed_notification(self, session_id: int) -> Notification:
        session = self._session_or_404(session_id)
        subject = "Attendance session completed"
        message = (
            f"Attendance session {session.id} for {session.session_date.isoformat()} "
            f"has been completed."
        )
        faculty_id = session.subject_assignment.faculty_id
        return self.send_faculty_alert(faculty_id, subject, message)

    def absent_notification(self, student_id: int, session_id: int) -> Notification:
        student = self._student_or_404(student_id)
        session = self._session_or_404(session_id)
        subject = "Absence notification"
        message = (
            f"Student {student.user.full_name} ({student.student_number}) was marked absent "
            f"for attendance session {session.id} on {session.session_date.isoformat()}."
        )
        return self.send_student_alert(student_id, subject, message)

    def parent_notification(self, student_id: int, message: str) -> Notification:
        student = self._student_or_404(student_id)
        subject = "Parent notification"
        recipient = student.guardian_email or student.user.email
        return send_email(self.db, recipient, subject, message, student.user_id)

    def history(
        self,
        *,
        page: int,
        size: int,
        search: str | None = None,
        status: str | None = None,
        channel: str | None = None,
        user_id: int | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> tuple[list[dict], int]:
        user_alias = aliased(User)
        stmt = select(Notification, user_alias.email.label("recipient_email")).select_from(Notification).outerjoin(user_alias, Notification.user_id == user_alias.id)
        conditions = []
        if search:
            term = f"%{search}%"
            conditions.append(or_(Notification.subject.ilike(term), Notification.message.ilike(term)))
        if status:
            try:
                conditions.append(Notification.status == NotificationStatus(status))
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid notification status") from exc
        if channel:
            conditions.append(Notification.channel == channel)
        if user_id is not None:
            conditions.append(Notification.user_id == user_id)
        if start_date is not None:
            conditions.append(func.date(Notification.created_at) >= start_date)
        if end_date is not None:
            conditions.append(func.date(Notification.created_at) <= end_date)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self.db.execute(stmt.order_by(Notification.created_at.desc()).offset((page - 1) * size).limit(size)).mappings().all()
        items = []
        for row in rows:
            notification = row["Notification"]
            items.append(
                NotificationOut(
                    id=notification.id,
                    user_id=notification.user_id,
                    channel=notification.channel,
                    subject=notification.subject,
                    message=notification.message,
                    status=notification.status,
                    sent_at=notification.sent_at,
                    created_at=notification.created_at,
                    updated_at=notification.updated_at,
                    recipient_email=row.get("recipient_email"),
                ).model_dump(mode="json")
            )
        return items, total

    def get(self, notification_id: int) -> dict:
        notification = self.db.get(Notification, notification_id)
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        recipient_email = None
        if notification.user_id:
            user = self.db.get(User, notification.user_id)
            recipient_email = user.email if user else None
        return NotificationOut(
            id=notification.id,
            user_id=notification.user_id,
            channel=notification.channel,
            subject=notification.subject,
            message=notification.message,
            status=notification.status,
            sent_at=notification.sent_at,
            created_at=notification.created_at,
            updated_at=notification.updated_at,
            recipient_email=recipient_email,
        ).model_dump(mode="json")

    def retry(self, notification_id: int, to_email: str | None = None) -> Notification:
        notification = self.db.get(Notification, notification_id)
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        recipient = to_email
        if recipient is None and notification.user_id is not None:
            user = self.db.get(User, notification.user_id)
            recipient = user.email if user else None
        if recipient is None:
            raise HTTPException(status_code=400, detail="Recipient email is required for retry")
        message = notification.message.split("\n\nDelivery error:", 1)[0]
        return send_email(self.db, recipient, notification.subject, message, notification.user_id)

    def history_page(
        self,
        *,
        page: int,
        size: int,
        search: str | None = None,
        status: str | None = None,
        channel: str | None = None,
        user_id: int | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> NotificationHistoryOut:
        items, total = self.history(
            page=page,
            size=size,
            search=search,
            status=status,
            channel=channel,
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )
        return NotificationHistoryOut(items=items, total=total, page=page, size=size)
