from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.responses import ok
from app.db.session import get_db
from app.models.entities import FaceEmbedding, Student, User
from app.models.enums import UserRole
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
        raise HTTPException(403, "Insufficient permissions")
    return student


@router.get("/me")
def my_profile(user: User = Depends(require_roles(UserRole.STUDENT)), db: Session = Depends(get_db)):
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        raise HTTPException(404, "Student profile not found")
    return ok({"student_id": student.id, "student_number": student.student_number, "attendance_percentage": attendance_percentage(db, student.id)})


@router.post("/{student_id}/faces")
async def enroll_faces(student_id: int, files: list[UploadFile] = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_accessible_student(db, student_id, user)
    provider = get_face_provider()
    created = 0
    for file in files:
        vectors = provider.extract(await file.read())
        if len(vectors) != 1:
            raise HTTPException(400, f"{file.filename} must contain exactly one detectable face")
        vector = vectors[0]
        db.add(FaceEmbedding(student_id=student_id, embedding=vector.embedding, image_path=file.filename, model_name=vector.model_name, model_version=vector.model_version))
        created += 1
    db.commit()
    return ok({"embeddings_created": created}, "Face enrollment complete")


@router.post("/{student_id}/reenroll-face")
async def reenroll_face(student_id: int, files: list[UploadFile] = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_accessible_student(db, student_id, user)
    db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student_id).update({"is_active": False})
    return await enroll_faces(student_id, files, user, db)
