from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.core.config import get_settings
from app.core.responses import ok
from app.db.session import get_db
from app.models.entities import AttendanceRecord, AttendanceSession, FaceEmbedding, Student, SubjectAssignment, User
from app.models.enums import AttendanceStatus, UserRole
from app.services.attendance import attendance_percentage
from app.services.face import get_face_provider
from app.services.file_storage import delete_face_upload, save_face_upload

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
    student = db.scalar(
        select(Student)
        .options(
            selectinload(Student.department),
            selectinload(Student.course),
            selectinload(Student.user),
        )
        .where(Student.user_id == user.id)
    )
    if not student:
        raise HTTPException(404, "Student profile not found")

    # Fetch all subject assignments for student's section
    assignments = db.scalars(
        select(SubjectAssignment)
        .options(selectinload(SubjectAssignment.subject))
        .where(SubjectAssignment.section == student.section)
    ).all()

    subject_breakdown = []
    total_conducted = 0
    total_attended = 0

    for sa in assignments:
        subj = sa.subject
        if not subj or subj.course_id != student.course_id:
            continue

        session_ids = db.scalars(
            select(AttendanceSession.id).where(AttendanceSession.subject_assignment_id == sa.id)
        ).all()

        cond = len(session_ids)
        if cond == 0:
            continue

        att = db.scalar(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
            )
        ) or 0

        abs_cnt = cond - att
        pct = round((att / cond) * 100, 1)

        total_conducted += cond
        total_attended += att

        status_str = "ELIGIBLE" if pct >= 75.0 else ("WARNING" if pct >= 65.0 else "DEBARRED")

        if pct >= 75.0:
            max_miss = max(0, int((att / 0.75) - cond))
            margin_msg = f"Can miss {max_miss} more classes" if max_miss > 0 else "Maintain current attendance"
        else:
            needed = max(1, int((0.75 * cond - att) / 0.25))
            margin_msg = f"Need {needed} consecutive attendances for 75%"

        subject_breakdown.append(
            {
                "subject_code": subj.code,
                "subject_name": subj.name,
                "credits": subj.credits or 4,
                "conducted": cond,
                "attended": att,
                "absent": abs_cnt,
                "percentage": pct,
                "status": status_str,
                "margin_msg": margin_msg,
            }
        )

    overall_pct = round((total_attended / total_conducted) * 100, 1) if total_conducted > 0 else 0.0
    is_eligible = overall_pct >= 75.0

    if overall_pct >= 75.0 and total_conducted > 0:
        max_miss_overall = max(0, int((total_attended / 0.75) - total_conducted))
        overall_margin_msg = f"You can safely miss up to {max_miss_overall} more classes without losing end-sem examination eligibility."
    elif total_conducted > 0:
        needed_overall = max(1, int((0.75 * total_conducted - total_attended) / 0.25))
        overall_margin_msg = f"You require {needed_overall} more attendances to attain the 75% end-sem examination threshold."
    else:
        overall_margin_msg = "No classes conducted yet."

    return ok(
        {
            "student_id": student.id,
            "student_number": student.student_number,
            "admission_no": student.admission_no,
            "full_name": student.user.full_name,
            "email": student.user.email,
            "roll_no": student.roll_no,
            "date_of_birth": student.date_of_birth.isoformat() if student.date_of_birth else None,
            "student_mobile": student.student_mobile,
            "father_mobile": student.father_mobile,
            "department_name": student.department.name if student.department else "Computer Science & Engineering",
            "course_name": student.course.name if student.course else "B.Tech CSE",
            "section": student.section,
            "semester": student.semester,
            "batch": student.batch,
            "attendance_percentage": overall_pct,
            "total_conducted": total_conducted,
            "total_attended": total_attended,
            "is_eligible": is_eligible,
            "overall_margin_msg": overall_margin_msg,
            "subject_breakdown": subject_breakdown,
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
