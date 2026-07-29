from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.config import get_settings
from app.core.responses import ok
from app.db.session import get_db
from app.models.entities import FaceEmbedding, Student, User
from app.models.enums import UserRole
from app.services.file_storage import delete_face_upload, save_face_upload
from app.services.attendance import attendance_percentage
from app.services.face import get_face_provider

router = APIRouter(prefix="/students", tags=["students"])


def get_accessible_student(db: Session, student_id: int, user: User) -> Student:
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    roles = {assignment.role for assignment in user.roles}

    if UserRole.ADMIN in roles or UserRole.FACULTY in roles:
        return student
    if student.user_id != user.id:
        raise HTTPException(403, "Forbidden")
    return student


@router.get("/me")
def get_my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        raise HTTPException(404, "Student profile not found")

    return ok(
        {
            "student_id": student.id,
            "student_number": student.student_number,
            "admission_no": student.admission_no,
            "full_name": student.full_name,
            "email": student.email,
            "roll_no": student.roll_no,
            "date_of_birth": student.date_of_birth.isoformat() if student.date_of_birth else None,
            "student_mobile": student.student_mobile,
            "father_mobile": student.father_mobile,
            "attendance_percentage": attendance_percentage(db, student.id),
        }
    )


@router.post("/{student_id}/faces")
async def enroll_faces(student_id: int, files: list[UploadFile] = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_accessible_student(db, student_id, user)
    settings = get_settings()

    existing_active = db.scalar(
        select(func.count(FaceEmbedding.id)).where(
            FaceEmbedding.student_id == student_id,
            FaceEmbedding.is_active.is_(True)
        )
    ) or 0

    if existing_active + len(files) > settings.face_max_embeddings_per_student:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot exceed {settings.face_max_embeddings_per_student} active face embeddings (currently has {existing_active}). Use re-enrollment to replace existing faces."
        )

    provider = get_face_provider()
    created = 0
    saved_paths: list[str] = []
    try:
        for file in files:
            content = await file.read()
            vectors = provider.extract(content)
            if len(vectors) != 1:
                raise HTTPException(400, f"{file.filename} must contain exactly one detectable face")
            vector = vectors[0]
            relative_path = save_face_upload(student_id, file, content)
            saved_paths.append(relative_path)
            db.add(
                FaceEmbedding(
                    student_id=student_id,
                    embedding=vector.embedding,
                    image_path=relative_path,
                    model_name=vector.model_name,
                    model_version=vector.model_version,
                )
            )
            created += 1
        db.commit()
    except Exception:
        db.rollback()
        for relative_path in saved_paths:
            delete_face_upload(relative_path)
        raise
    return ok({"embeddings_created": created}, "Face enrollment complete")


@router.post("/{student_id}/reenroll-face")
async def reenroll_face(student_id: int, files: list[UploadFile] = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_accessible_student(db, student_id, user)
    db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student_id).update({"is_active": False})
    return await enroll_faces(student_id, files, user, db)
