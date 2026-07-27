from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.responses import ok
from app.db.session import get_db
from app.models.enums import UserRole
from app.services.search import SearchService

router = APIRouter(prefix="/search", tags=["search"], dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY, UserRole.STUDENT))])


@router.get("")
def global_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return ok(SearchService(db).search(q, limit), "Search completed")
