from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ==========================
# Login
# ==========================

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class LoginUserOut(ORMModel):
    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    email_verified: bool
    roles: list[UserRole]

    @classmethod
    def model_validate(cls, obj):
        return cls(
            id=obj.id,
            email=obj.email,
            full_name=obj.full_name,
            is_active=obj.is_active,
            email_verified=obj.email_verified,
            roles=[r.role for r in obj.roles],
        )


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: LoginUserOut


# ==========================
# Activation
# ==========================

class SendActivationEmailIn(BaseModel):
    email: EmailStr


class ActivateAccountIn(BaseModel):
    token: str
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)


# ==========================
# Password Reset
# ==========================

class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)