from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import AttendanceRecord, AttendanceSession, FaceEmbedding, Student
from app.models.enums import AttendanceSource, AttendanceStatus, SessionStatus
from app.services.face import FaceRecognitionProvider


def mark_manual(db: Session, session_id: int, student_id: int, marked_by_id: int, status: AttendanceStatus, remarks: str | None):
    record = db.scalar(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id, AttendanceRecord.student_id == student_id))
    if record is None:
        record = AttendanceRecord(session_id=session_id, student_id=student_id, marked_by_id=marked_by_id)
        db.add(record)
    record.status = status
    record.source = AttendanceSource.MANUAL
    record.marked_by_id = marked_by_id
    record.remarks = remarks
    record.marked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record


def recognize_and_mark(db: Session, session_id: int, marked_by_id: int, image_bytes: bytes, provider: FaceRecognitionProvider):
    session = db.get(AttendanceSession, session_id)
    if session is None:
        raise ValueError("Attendance session not found")
    session.status = SessionStatus.ACTIVE
    faces = provider.extract(image_bytes)
    active_embeddings = db.scalars(select(FaceEmbedding).where(FaceEmbedding.is_active.is_(True))).all()
    threshold = get_settings().face_similarity_threshold
    marked: list[AttendanceRecord] = []
    matches: list[dict] = []
    unknown = 0
    for face in faces:
        best_embedding = None
        best_score = 0.0
        for embedding in active_embeddings:
            score = provider.compare(face.embedding, embedding.embedding)
            if score > best_score:
                best_embedding = embedding
                best_score = score
        if best_embedding is None or best_score < threshold:
            unknown += 1
            matches.append({"student_id": None, "confidence": best_score, "bbox": face.bbox, "status": "unknown"})
            continue
        existing = db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == best_embedding.student_id,
            )
        )
        if existing is None:
            existing = AttendanceRecord(
                session_id=session_id,
                student_id=best_embedding.student_id,
                marked_by_id=marked_by_id,
                status=AttendanceStatus.PRESENT,
                source=AttendanceSource.FACE,
                confidence=best_score,
            )
            db.add(existing)
        else:
            existing.confidence = max(existing.confidence or 0, best_score)
        marked.append(existing)
        student = db.get(Student, best_embedding.student_id)
        matches.append({
            "student_id": best_embedding.student_id,
            "student_name": student.user.full_name if student else "Student",
            "confidence": best_score,
            "bbox": face.bbox,
            "status": "marked" if existing in marked else "duplicate",
        })
    db.commit()
    for record in marked:
        db.refresh(record)
    return {"detected_students": len(faces) - unknown, "unknown_faces": unknown, "marked": marked, "matches": matches}


def attendance_percentage(db: Session, student_id: int) -> float:
    total = db.scalar(select(func.count()).select_from(AttendanceRecord).where(AttendanceRecord.student_id == student_id)) or 0
    if total == 0:
        return 0
    present = db.scalar(
        select(func.count()).select_from(AttendanceRecord).where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.status == AttendanceStatus.PRESENT,
        )
    ) or 0
    return round((present / total) * 100, 2)
