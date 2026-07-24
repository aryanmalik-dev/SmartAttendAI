from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.responses import ok, page
from app.core.security import hash_password
from app.db.session import get_db
from app.models.entities import Classroom, Course, Department, Faculty, Student, SystemSetting, User
from app.models.enums import UserRole
from app.schemas.common import (
    ClassroomIn,
    ClassroomOut,
    CourseIn,
    CourseOut,
    DepartmentIn,
    DepartmentOut,
    FacultyIn,
    FacultyOut,
    SettingsIn,
    StudentIn,
    StudentOut,
)

router = APIRouter(tags=["admin"])


def paginate(db: Session, model, page_number: int, size: int, search: str | None = None, fields: tuple[str, ...] = ()):
    stmt = select(model)
    if search and fields:
        stmt = stmt.where(or_(*[getattr(model, field).ilike(f"%{search}%") for field in fields]))
    total = len(db.scalars(stmt).all())
    items = db.scalars(stmt.offset((page_number - 1) * size).limit(size)).all()
    return items, total


@router.get("/departments")
def list_departments(_: User = Depends(get_current_user), db: Session = Depends(get_db), p: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), search: str | None = None):
    items, total = paginate(db, Department, p, size, search, ("code", "name"))
    return page([DepartmentOut.model_validate(i).model_dump() for i in items], total, p, size)


@router.post("/departments")
def create_department(payload: DepartmentIn, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = Department(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(DepartmentOut.model_validate(item).model_dump(), "Department created")


@router.put("/departments/{item_id}")
def update_department(item_id: int, payload: DepartmentIn, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = db.get(Department, item_id)
    if not item:
        raise HTTPException(404, "Department not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    return ok(DepartmentOut.model_validate(item).model_dump(), "Department updated")


@router.delete("/departments/{item_id}")
def delete_department(item_id: int, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = db.get(Department, item_id)
    if not item:
        raise HTTPException(404, "Department not found")
    db.delete(item)
    db.commit()
    return ok(message="Department deleted")


@router.get("/classrooms")
def list_classrooms(_: User = Depends(get_current_user), db: Session = Depends(get_db), p: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), search: str | None = None):
    items, total = paginate(db, Classroom, p, size, search, ("name", "building"))
    return page([ClassroomOut.model_validate(i).model_dump() for i in items], total, p, size)


@router.post("/classrooms")
def create_classroom(payload: ClassroomIn, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = Classroom(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(ClassroomOut.model_validate(item).model_dump(), "Classroom created")


@router.put("/classrooms/{item_id}")
def update_classroom(item_id: int, payload: ClassroomIn, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = db.get(Classroom, item_id)
    if not item:
        raise HTTPException(404, "Classroom not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    return ok(ClassroomOut.model_validate(item).model_dump(), "Classroom updated")


@router.delete("/classrooms/{item_id}")
def delete_classroom(item_id: int, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = db.get(Classroom, item_id)
    if not item:
        raise HTTPException(404, "Classroom not found")
    db.delete(item)
    db.commit()
    return ok(message="Classroom deleted")


@router.get("/courses")
def list_courses(_: User = Depends(get_current_user), db: Session = Depends(get_db), p: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), search: str | None = None):
    items, total = paginate(db, Course, p, size, search, ("code", "name"))
    return page([CourseOut.model_validate(i).model_dump() for i in items], total, p, size)


@router.post("/courses")
def create_course(payload: CourseIn, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = Course(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(CourseOut.model_validate(item).model_dump(), "Course created")


@router.put("/courses/{item_id}")
def update_course(item_id: int, payload: CourseIn, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = db.get(Course, item_id)
    if not item:
        raise HTTPException(404, "Course not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    return ok(CourseOut.model_validate(item).model_dump(), "Course updated")


@router.delete("/courses/{item_id}")
def delete_course(item_id: int, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = db.get(Course, item_id)
    if not item:
        raise HTTPException(404, "Course not found")
    db.delete(item)
    db.commit()
    return ok(message="Course deleted")


@router.get("/faculty")
def list_faculty(_: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db), p: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), search: str | None = None):
    stmt = select(Faculty).join(User)
    if search:
        stmt = stmt.where(or_(Faculty.employee_id.ilike(f"%{search}%"), User.full_name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
    total = len(db.scalars(stmt).all())
    items = db.scalars(stmt.offset((p - 1) * size).limit(size)).all()
    return page([FacultyOut.model_validate(i).model_dump(mode="json") for i in items], total, p, size)


@router.post("/faculty")
def create_faculty(payload: FacultyIn, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    user = User(email=payload.user.email, full_name=payload.user.full_name, hashed_password=hash_password(payload.user.password), role=UserRole.FACULTY)
    db.add(user)
    db.flush()
    item = Faculty(user_id=user.id, employee_id=payload.employee_id, department_id=payload.department_id, designation=payload.designation, phone=payload.phone)
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(FacultyOut.model_validate(item).model_dump(mode="json"), "Faculty created")


@router.get("/students")
def list_students(_: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db), p: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), search: str | None = None):
    stmt = select(Student).join(User)
    if search:
        stmt = stmt.where(or_(Student.student_number.ilike(f"%{search}%"), User.full_name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
    total = len(db.scalars(stmt).all())
    items = db.scalars(stmt.offset((p - 1) * size).limit(size)).all()
    return page([StudentOut.model_validate(i).model_dump(mode="json") for i in items], total, p, size)


@router.post("/students")
def create_student(payload: StudentIn, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    user = User(email=payload.user.email, full_name=payload.user.full_name, hashed_password=hash_password(payload.user.password), role=UserRole.STUDENT)
    db.add(user)
    db.flush()
    item = Student(
        user_id=user.id,
        student_number=payload.student_number,
        department_id=payload.department_id,
        enrollment_year=payload.enrollment_year,
        phone=payload.phone,
        guardian_email=payload.guardian_email,
        low_attendance_threshold=payload.low_attendance_threshold,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ok(StudentOut.model_validate(item).model_dump(mode="json"), "Student created")


@router.post("/settings")
def upsert_setting(payload: SettingsIn, _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    item = db.scalar(select(SystemSetting).where(SystemSetting.key == payload.key))
    if not item:
        item = SystemSetting(key=payload.key, value=payload.value, description=payload.description)
        db.add(item)
    else:
        item.value = payload.value
        item.description = payload.description
    db.commit()
    return ok({"key": item.key, "value": item.value}, "Setting saved")
