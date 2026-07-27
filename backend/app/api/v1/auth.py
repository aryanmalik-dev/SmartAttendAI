from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.responses import ok
from app.db.session import get_db
from app.models.entities import User
from app.api.deps import get_current_user
from app.schemas.auth import (
    LoginIn,
    SendActivationEmailIn,
    ActivateAccountIn,
    ForgotPasswordIn,
    ResetPasswordIn,
)
from app.services.auth import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/login", response_model=dict)
def login(
    payload: LoginIn,
    db: Session = Depends(get_db),
):
    token = AuthService(db).login(payload)

    return ok(
        token.model_dump(mode="json"),
        "Logged in",
    )


@router.get("/me", response_model=dict)
def me(
    user: User = Depends(get_current_user),
):
    return ok(
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "roles": [r.role.value for r in user.roles],
            "is_active": user.is_active,
            "email_verified": user.email_verified,
        }
    )


@router.post("/send-activation", response_model=dict)
def send_activation(
    payload: SendActivationEmailIn,
    db: Session = Depends(get_db),
):
    result = AuthService(db).send_activation(
        payload.email,
    )

    return ok(
        result,
        "Activation email sent",
    )


@router.post("/activate", response_model=dict)
def activate(
    payload: ActivateAccountIn,
    db: Session = Depends(get_db),
):

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match",
        )

    result = AuthService(db).activate_account(
        payload.token,
        payload.password,
    )

    return ok(
        result,
        "Account activated",
    )


@router.post("/forgot-password", response_model=dict)
def forgot_password(
    payload: ForgotPasswordIn,
    db: Session = Depends(get_db),
):

    AuthService(db).forgot_password(
        payload.email,
    )

    return ok(
        message="If the account exists, an email has been sent.",
    )


@router.post("/reset-password", response_model=dict)
def reset_password(
    payload: ResetPasswordIn,
    db: Session = Depends(get_db),
):

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match",
        )

    result = AuthService(db).reset_password(
        payload.token,
        payload.password,
    )

    return ok(
        result,
        "Password updated",
    )


@router.post("/refresh", response_model=dict)
def refresh(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    token = AuthService(db).refresh(
        user,
    )

    return ok(
        token,
        "Token refreshed",
    )


@router.post("/logout", response_model=dict)
def logout():
    return ok(
        message="Logged out",
    )