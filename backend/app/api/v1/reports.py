from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.enums import UserRole
from app.services.reports import export_csv, export_pdf, session_summary

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))])


@router.get("/daily")
def daily(session_id: int, db: Session = Depends(get_db)):
    return {"success": True, "message": "Daily report", "data": session_summary(db, session_id)}


@router.get("/weekly")
def weekly(session_id: int, db: Session = Depends(get_db)):
    return {"success": True, "message": "Weekly report", "data": session_summary(db, session_id)}


@router.get("/monthly")
def monthly(session_id: int, db: Session = Depends(get_db)):
    return {"success": True, "message": "Monthly report", "data": session_summary(db, session_id)}


@router.get("/export/csv")
def csv_export(db: Session = Depends(get_db), session_id: int | None = None):
    return Response(content=export_csv(db, session_id), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=attendance.csv"})


@router.get("/export/pdf")
def pdf_export(db: Session = Depends(get_db), session_id: int | None = None):
    return Response(content=export_pdf(db, "SmartAttend AI Attendance Report", session_id), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=attendance.pdf"})
