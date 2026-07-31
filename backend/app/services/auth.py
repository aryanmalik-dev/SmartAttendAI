from datetime import datetime, timedelta, timezone
import secrets

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.entities import ActivationToken, Faculty, PasswordResetToken, Student, User
from app.schemas.auth import LoginIn, LoginUserOut, TokenOut
from app.services.email import (
    send_activation_email,
    send_reset_password_email,
)


class AuthService:

    def __init__(self, db: Session):
        self.db = db

    def login(self, payload: LoginIn):
        email = payload.email.strip().lower()

        user = self.db.scalar(
            select(User).where(func.lower(User.email) == email)
        )

        if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed. Check your email and password.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account disabled",
            )

        roles = [r.role.value if hasattr(r, "role") else r.value if hasattr(r, "value") else str(r) for r in user.roles]

        access = create_access_token(
            str(user.id),
            {
                "roles": roles,
            },
        )

        refresh = create_refresh_token(
            str(user.id),
        )

        return TokenOut(
            access_token=access,
            refresh_token=refresh,
            user=LoginUserOut.model_validate(user),
        )

    def send_activation(
        self,
        email: str,
    ):

        user = self.db.scalar(
            select(User).where(User.email == email)
        )

        if not user:
            raise HTTPException(
                404,
                "User not found",
            )

        if user.email_verified:
            raise HTTPException(
                400,
                "Account already activated",
            )

        token = secrets.token_urlsafe(48)

        activation = ActivationToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc)
            + timedelta(hours=24),
        )

        self.db.add(activation)
        self.db.commit()

        send_activation_email(
            self.db,
            user.email,
            token,
            user.id,
        )

        return {"message": "Activation email sent"}

    def activate_account(
        self,
        token: str,
        password: str,
    ):

        activation = self.db.scalar(
            select(ActivationToken).where(
                ActivationToken.token == token
            )
        )

        if not activation:
            raise HTTPException(
                404,
                "Invalid token",
            )

        if activation.used:
            raise HTTPException(
                400,
                "Token already used",
            )

        if activation.expires_at < datetime.now(
            timezone.utc
        ):
            raise HTTPException(
                400,
                "Token expired",
            )

        user = activation.user

        user.password_hash = hash_password(password)
        user.email_verified = True
        user.is_active = True

        activation.used = True

        self.db.commit()

        return {
            "message": "Account activated"
        }

    def forgot_password(
        self,
        email: str,
    ):
        user = self.db.scalar(
            select(User).where(User.email == email)
        )

        if not user:
            return

        token = secrets.token_urlsafe(48)

        reset = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc)
            + timedelta(hours=1),
        )

        self.db.add(reset)

        self.db.commit()

        send_reset_password_email(
            self.db,
            user.email,
            token,
            user.id,
        )

    def reset_password(
        self,
        token: str,
        password: str,
    ):

        reset = self.db.scalar(
            select(PasswordResetToken).where(
                PasswordResetToken.token == token
            )
        )

        if not reset:
            raise HTTPException(
                404,
                "Invalid token",
            )

        if reset.used:
            raise HTTPException(
                400,
                "Token already used",
            )

        if reset.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                400,
                "Token expired",
            )

        reset.user.password_hash = hash_password(
            password
        )

        reset.used = True

        self.db.commit()

        return {
            "message": "Password updated"
        }