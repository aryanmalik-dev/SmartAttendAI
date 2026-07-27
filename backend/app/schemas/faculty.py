from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.auth import LoginUserOut
from app.schemas.common import UserCreate


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class FacultyCreate(BaseModel):
    user: UserCreate
    employee_id: str = Field(min_length=2, max_length=60)
    department_id: int
    designation: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)


class FacultyUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8)
    employee_id: str | None = Field(default=None, min_length=2, max_length=60)
    department_id: int | None = None
    designation: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None
    email_verified: bool | None = None


class FacultyOut(ORMModel):
    id: int
    employee_id: str
    department_id: int
    designation: str | None
    phone: str | None
    user: LoginUserOut
