from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

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

    @model_validator(mode="before")
    @classmethod
    def _normalize_roles(cls, data):
        if hasattr(data, "roles"):
            return {
                "id": data.id,
                "email": data.email,
                "full_name": data.full_name,
                "is_active": data.is_active,
                "email_verified": data.email_verified,
                "roles": [role.role if hasattr(role, "role") else role for role in data.roles],
            }
        if isinstance(data, dict) and "roles" in data:
            roles = data.get("roles") or []
            data["roles"] = [role.role if hasattr(role, "role") else role for role in roles]
        return data


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
