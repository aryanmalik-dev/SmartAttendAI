import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Notification
from app.models.enums import NotificationStatus


def send_email(db: Session, to_email: str, subject: str, message: str, user_id: int | None = None) -> Notification:
    settings = get_settings()
    notification = Notification(user_id=user_id, subject=subject, message=message)
    db.add(notification)
    db.flush()
    email = EmailMessage()
    email["From"] = settings.smtp_from
    email["To"] = to_email
    email["Subject"] = subject
    email.set_content(message)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_username:
                smtp.starttls()
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(email)
        notification.status = NotificationStatus.SENT
        notification.sent_at = datetime.now(timezone.utc)
    except Exception as exc:
        notification.status = NotificationStatus.FAILED
        notification.message = f"{message}\n\nDelivery error: {exc}"
    db.commit()
    db.refresh(notification)
    return notification


from app.core.config import get_settings


def send_activation_email(
    db: Session,
    email: str,
    token: str,
    user_id: int,
):
    settings = get_settings()

    link = (
        f"{settings.frontend_url}"
        f"/activate?token={token}"
    )

    body = f"""
Welcome to SmartAttendAI.

Activate your account using the link below.

{link}

This link expires in 24 hours.
"""

    return send_email(
        db=db,
        to_email=email,
        subject="Activate your SmartAttendAI account",
        message=body,
        user_id=user_id,
    )


def send_reset_password_email(
    db: Session,
    email: str,
    token: str,
    user_id: int,
):
    settings = get_settings()

    link = (
        f"{settings.frontend_url}"
        f"/reset-password?token={token}"
    )

    body = f"""
Someone requested a password reset.

Use the link below.

{link}

This link expires in 1 hour.
"""

    return send_email(
        db=db,
        to_email=email,
        subject="Reset your SmartAttendAI password",
        message=body,
        user_id=user_id,
    )