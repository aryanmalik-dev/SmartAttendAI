from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import NotificationStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class NotificationSendIn(BaseModel):
    to_email: EmailStr
    subject: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)
    user_id: int | None = None


class NotificationOut(ORMModel):
    id: int
    user_id: int | None
    channel: str
    subject: str
    message: str
    status: NotificationStatus
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime
    recipient_email: EmailStr | None = None


class NotificationRetryIn(BaseModel):
    to_email: EmailStr | None = None


class NotificationHistoryOut(ORMModel):
    items: list[NotificationOut]
    total: int
    page: int
    size: int
