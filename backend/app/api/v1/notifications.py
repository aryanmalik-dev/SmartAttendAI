from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.responses import ok
from app.db.session import get_db
from app.models.enums import UserRole
from app.services.email import send_email

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))])


@router.post("/send-summary")
def send_summary(to_email: str, subject: str = "SmartAttend AI Daily Attendance Summary", message: str = "Your attendance summary is attached in the portal.", db: Session = Depends(get_db)):
    notification = send_email(db, to_email, subject, message)
    return ok({"notification_id": notification.id, "status": notification.status.value}, "Notification processed")
