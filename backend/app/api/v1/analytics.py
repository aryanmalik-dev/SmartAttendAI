from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.responses import ok
from app.db.session import get_db
from app.services.analytics import dashboard_metrics

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(get_current_user)])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return ok(dashboard_metrics(db))
