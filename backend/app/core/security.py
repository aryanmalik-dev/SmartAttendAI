from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _create_token(
    subject: str,
    expires_delta: timedelta,
    claims: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()

    payload = {
        "sub": subject,
        "exp": datetime.now(timezone.utc) + expires_delta,
    }

    if claims:
        payload.update(claims)

    return jwt.encode(
        payload,
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def create_access_token(
    subject: str,
    claims: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    token_claims = {"type": "access"}
    if claims:
        token_claims.update(claims)

    return _create_token(
        subject,
        timedelta(minutes=settings.access_token_expire_minutes),
        token_claims,
    )


def create_refresh_token(subject: str) -> str:
    settings = get_settings()
    return _create_token(
        subject,
        timedelta(days=settings.refresh_token_expire_days),
        {"type": "refresh"},
    )


def create_activation_token(subject: str) -> str:
    settings = get_settings()
    return _create_token(
        subject,
        timedelta(hours=settings.activation_token_expire_hours),
        {"type": "activation"},
    )


def create_reset_password_token(subject: str) -> str:
    settings = get_settings()
    return _create_token(
        subject,
        timedelta(hours=settings.reset_token_expire_hours),
        {"type": "reset"},
    )


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()

    try:
        return jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )

    except JWTError as exc:
        raise ValueError(
            "Invalid or expired token"
        ) from exc