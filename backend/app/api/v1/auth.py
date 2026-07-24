from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ok
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.entities import User
from app.schemas.common import LoginIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=dict)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user.id), {"role": user.role.value})
    return ok(TokenOut(access_token=token, user=UserOut.model_validate(user)).model_dump(mode="json"), "Logged in")


@router.get("/me", response_model=dict)
def me(user: User = Depends(get_current_user)):
    return ok(UserOut.model_validate(user).model_dump(mode="json"))


@router.post("/logout", response_model=dict)
def logout():
    return ok(message="Logged out")
