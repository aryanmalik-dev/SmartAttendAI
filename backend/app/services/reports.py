import csv
from io import BytesIO, StringIO

import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import AttendanceRecord, AttendanceSession


def records_dataframe(db: Session, session_id: int | None = None) -> pd.DataFrame:
    stmt = select(AttendanceRecord)
    if session_id:
        stmt = stmt.where(AttendanceRecord.session_id == session_id)
    rows = db.scalars(stmt).all()
    return pd.DataFrame([
        {
            "record_id": row.id,
            "session_id": row.session_id,
            "student_id": row.student_id,
            "status": row.status.value,
            "confidence": row.confidence,
            "source": row.source.value,
            "marked_at": row.marked_at.isoformat() if row.marked_at else "",
        }
        for row in rows
    ])


def export_csv(db: Session, session_id: int | None = None) -> str:
    df = records_dataframe(db, session_id)
    buffer = StringIO()
    df.to_csv(buffer, index=False, quoting=csv.QUOTE_MINIMAL)
    return buffer.getvalue()


def export_pdf(db: Session, title: str, session_id: int | None = None) -> bytes:
    df = records_dataframe(db, session_id)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    pdf.setTitle(title)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(40, 750, title)
    pdf.setFont("Helvetica", 9)
    y = 720
    for _, row in df.head(40).iterrows():
        pdf.drawString(40, y, f"Record {row['record_id']} | Session {row['session_id']} | Student {row['student_id']} | {row['status']} | {row['confidence']}")
        y -= 18
        if y < 60:
            pdf.showPage()
            y = 740
    pdf.save()
    return buffer.getvalue()


def session_summary(db: Session, session_id: int) -> dict:
    session = db.get(AttendanceSession, session_id)
    count = len(session.records) if session else 0
    return {"session_id": session_id, "records": count, "status": session.status.value if session else "missing"}
