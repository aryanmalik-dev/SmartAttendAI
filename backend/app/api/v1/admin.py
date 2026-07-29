from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from io import BytesIO

from app.api.deps import get_current_user, require_roles
from app.core.responses import ok, page
from app.db.session import get_db
from app.models.entities import SystemSetting, User
from app.models.enums import UserRole
from app.schemas.classroom import ClassroomCreate, ClassroomOut, ClassroomUpdate
from app.schemas.common import SettingsIn
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate
from app.schemas.faculty import FacultyCreate, FacultyOut, FacultyUpdate
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate
from app.schemas.subject import SubjectCreate, SubjectOut, SubjectUpdate
from app.schemas.subject_assignment import SubjectAssignmentCreate, SubjectAssignmentOut, SubjectAssignmentUpdate
from app.services.classroom import ClassroomService
from app.services.course import CourseService
from app.services.department import DepartmentService
from app.services.faculty import FacultyService
from app.services.student import StudentService
from app.services.subject import SubjectService
from app.services.subject_assignment import SubjectAssignmentService

router = APIRouter(tags=["admin"])


def _items(items: list, schema):
    return [schema.model_validate(item).model_dump(mode="json") for item in items]


def _stream_bytes(data: bytes, filename: str, media_type: str) -> StreamingResponse:
    return StreamingResponse(BytesIO(data), media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _download_filename(base: str, file_format: str) -> tuple[str, str]:
    if file_format == "xlsx":
        return f"{base}.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return f"{base}.csv", "text/csv"


@router.get("/departments")
def list_departments(
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
    p: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    items, total = DepartmentService(db).list(p, size, search)
    return page(_items(items, DepartmentOut), total, p, size)


@router.get("/departments/{item_id}")
def get_department(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = DepartmentService(db).get(item_id)
    return ok(DepartmentOut.model_validate(item).model_dump(mode="json"))


@router.post("/departments")
def create_department(
    payload: DepartmentCreate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = DepartmentService(db).create(payload)
    return ok(DepartmentOut.model_validate(item).model_dump(mode="json"), "Department created")


@router.patch("/departments/{item_id}")
def update_department(
    item_id: int,
    payload: DepartmentUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = DepartmentService(db).update(item_id, payload)
    return ok(DepartmentOut.model_validate(item).model_dump(mode="json"), "Department updated")


@router.delete("/departments/{item_id}")
def delete_department(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    DepartmentService(db).delete(item_id)
    return ok(message="Department deleted")


@router.get("/classrooms")
def list_classrooms(
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
    p: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    items, total = ClassroomService(db).list(p, size, search)
    return page(_items(items, ClassroomOut), total, p, size)


@router.get("/classrooms/{item_id}")
def get_classroom(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = ClassroomService(db).get(item_id)
    return ok(ClassroomOut.model_validate(item).model_dump(mode="json"))


@router.post("/classrooms")
def create_classroom(
    payload: ClassroomCreate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = ClassroomService(db).create(payload)
    return ok(ClassroomOut.model_validate(item).model_dump(mode="json"), "Classroom created")


@router.patch("/classrooms/{item_id}")
def update_classroom(
    item_id: int,
    payload: ClassroomUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = ClassroomService(db).update(item_id, payload)
    return ok(ClassroomOut.model_validate(item).model_dump(mode="json"), "Classroom updated")


@router.delete("/classrooms/{item_id}")
def delete_classroom(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    ClassroomService(db).delete(item_id)
    return ok(message="Classroom deleted")


@router.get("/courses")
def list_courses(
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
    p: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    items, total = CourseService(db).list(p, size, search)
    return page(_items(items, CourseOut), total, p, size)


@router.get("/courses/{item_id}")
def get_course(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = CourseService(db).get(item_id)
    return ok(CourseOut.model_validate(item).model_dump(mode="json"))


@router.post("/courses")
def create_course(
    payload: CourseCreate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = CourseService(db).create(payload)
    return ok(CourseOut.model_validate(item).model_dump(mode="json"), "Course created")


@router.patch("/courses/{item_id}")
def update_course(
    item_id: int,
    payload: CourseUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = CourseService(db).update(item_id, payload)
    return ok(CourseOut.model_validate(item).model_dump(mode="json"), "Course updated")


@router.delete("/courses/{item_id}")
def delete_course(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    CourseService(db).delete(item_id)
    return ok(message="Course deleted")


@router.get("/subjects")
def list_subjects(
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
    p: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    items, total = SubjectService(db).list(p, size, search)
    return page(_items(items, SubjectOut), total, p, size)


@router.get("/subjects/{item_id}")
def get_subject(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = SubjectService(db).get(item_id)
    return ok(SubjectOut.model_validate(item).model_dump(mode="json"))


@router.post("/subjects")
def create_subject(
    payload: SubjectCreate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = SubjectService(db).create(payload)
    return ok(SubjectOut.model_validate(item).model_dump(mode="json"), "Subject created")


@router.patch("/subjects/{item_id}")
def update_subject(
    item_id: int,
    payload: SubjectUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = SubjectService(db).update(item_id, payload)
    return ok(SubjectOut.model_validate(item).model_dump(mode="json"), "Subject updated")


@router.delete("/subjects/{item_id}")
def delete_subject(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    SubjectService(db).delete(item_id)
    return ok(message="Subject deleted")


@router.get("/subject-assignments")
def list_subject_assignments(
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
    p: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    items, total = SubjectAssignmentService(db).list(p, size, search)
    return page(_items(items, SubjectAssignmentOut), total, p, size)


@router.get("/subject-assignments/{item_id}")
def get_subject_assignment(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = SubjectAssignmentService(db).get(item_id)
    return ok(SubjectAssignmentOut.model_validate(item).model_dump(mode="json"))


@router.post("/subject-assignments")
def create_subject_assignment(
    payload: SubjectAssignmentCreate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = SubjectAssignmentService(db).create(payload)
    return ok(SubjectAssignmentOut.model_validate(item).model_dump(mode="json"), "Subject assignment created")


@router.patch("/subject-assignments/{item_id}")
def update_subject_assignment(
    item_id: int,
    payload: SubjectAssignmentUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = SubjectAssignmentService(db).update(item_id, payload)
    return ok(SubjectAssignmentOut.model_validate(item).model_dump(mode="json"), "Subject assignment updated")


@router.delete("/subject-assignments/{item_id}")
def delete_subject_assignment(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    SubjectAssignmentService(db).delete(item_id)
    return ok(message="Subject assignment deleted")


@router.get("/faculty")
def list_faculty(
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
    p: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    items, total = FacultyService(db).list(p, size, search)
    return page(_items(items, FacultyOut), total, p, size)


@router.get("/faculty/me")
def get_my_faculty(
    user: User = Depends(require_roles(UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = FacultyService(db).get_by_user(user.id)
    return ok(FacultyOut.model_validate(item).model_dump(mode="json"))


@router.get("/faculty/{item_id}")
def get_faculty(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = FacultyService(db).get(item_id)
    return ok(FacultyOut.model_validate(item).model_dump(mode="json"))


@router.post("/faculty")
def create_faculty(
    payload: FacultyCreate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = FacultyService(db).create(payload)
    return ok(FacultyOut.model_validate(item).model_dump(mode="json"), "Faculty created")


@router.patch("/faculty/{item_id}")
def update_faculty(
    item_id: int,
    payload: FacultyUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = FacultyService(db).update(item_id, payload)
    return ok(FacultyOut.model_validate(item).model_dump(mode="json"), "Faculty updated")


@router.delete("/faculty/{item_id}")
def delete_faculty(
    item_id: int,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    FacultyService(db).delete(item_id)
    return ok(message="Faculty deleted")


@router.get("/students")
def list_students(
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
    p: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    sort: str | None = None,
    department_id: int | None = None,
    course_id: int | None = None,
    semester: int | None = None,
    section: str | None = None,
    batch: str | None = None,
):
    items, total = StudentService(db).list_students(
        page=p,
        size=size,
        search=search,
        sort=sort,
        department_id=department_id,
        course_id=course_id,
        semester=semester,
        section=section,
        batch=batch,
    )
    return page([StudentOut.model_validate(i).model_dump(mode="json") for i in items], total, p, size)


@router.post("/students")
def create_student(
    payload: StudentCreate,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = StudentService(db).create_student(payload)
    return ok(StudentOut.model_validate(item).model_dump(mode="json"), "Student created")


@router.patch("/students/{item_id}")
def update_student(
    item_id: int,
    payload: StudentUpdate,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    item = StudentService(db).update_student(item_id, payload)
    return ok(StudentOut.model_validate(item).model_dump(mode="json"), "Student updated")


@router.post("/settings")
def upsert_setting(
    payload: SettingsIn,
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    item = db.scalar(select(SystemSetting).where(SystemSetting.key == payload.key))
    if not item:
        item = SystemSetting(key=payload.key, value=payload.value, description=payload.description)
        db.add(item)
    else:
        item.value = payload.value
        item.description = payload.description
    db.commit()
    return ok({"key": item.key, "value": item.value}, "Setting saved")


@router.post("/departments/import")
def import_departments(
    file: UploadFile = File(...),
    _: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return ok(DepartmentService(db).import_file(file), "Departments imported")


@router.get("/departments/export")
def export_departments(
    file_format: str = "csv",
    search: str | None = None,
    sort: str | None = None,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)),
    db: Session = Depends(get_db),
):
    filename, media_type = _download_filename("departments", file_format)
    return _stream_bytes(DepartmentService(db).export(file_format, search=search, sort=sort), filename, media_type)


@router.get("/departments/template")
def template_departments(
    file_format: str = "csv",
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    filename, media_type = _download_filename("departments_template", file_format)
    return _stream_bytes(DepartmentService(db).template(file_format), filename, media_type)


@router.post("/classrooms/import")
def import_classrooms(file: UploadFile = File(...), _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    return ok(ClassroomService(db).import_file(file), "Classrooms imported")


@router.get("/classrooms/export")
def export_classrooms(file_format: str = "csv", search: str | None = None, sort: str | None = None, _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db)):
    filename, media_type = _download_filename("classrooms", file_format)
    return _stream_bytes(ClassroomService(db).export(file_format, search=search, sort=sort), filename, media_type)


@router.get("/classrooms/template")
def template_classrooms(file_format: str = "csv", db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.ADMIN))):
    filename, media_type = _download_filename("classrooms_template", file_format)
    return _stream_bytes(ClassroomService(db).template(file_format), filename, media_type)


@router.post("/courses/import")
def import_courses(file: UploadFile = File(...), _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    return ok(CourseService(db).import_file(file), "Courses imported")


@router.get("/courses/export")
def export_courses(file_format: str = "csv", search: str | None = None, sort: str | None = None, is_active: bool | None = None, _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db)):
    filename, media_type = _download_filename("courses", file_format)
    return _stream_bytes(CourseService(db).export(file_format, search=search, sort=sort, is_active=is_active), filename, media_type)


@router.get("/courses/template")
def template_courses(file_format: str = "csv", db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.ADMIN))):
    filename, media_type = _download_filename("courses_template", file_format)
    return _stream_bytes(CourseService(db).template(file_format), filename, media_type)


@router.post("/subjects/import")
def import_subjects(file: UploadFile = File(...), _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    return ok(SubjectService(db).import_file(file), "Subjects imported")


@router.get("/subjects/export")
def export_subjects(file_format: str = "csv", search: str | None = None, sort: str | None = None, department_id: int | None = None, course_id: int | None = None, semester: int | None = None, is_active: bool | None = None, _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db)):
    filename, media_type = _download_filename("subjects", file_format)
    return _stream_bytes(SubjectService(db).export(file_format, search=search, sort=sort, department_id=department_id, course_id=course_id, semester=semester, is_active=is_active), filename, media_type)


@router.get("/subjects/template")
def template_subjects(file_format: str = "csv", db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.ADMIN))):
    filename, media_type = _download_filename("subjects_template", file_format)
    return _stream_bytes(SubjectService(db).template(file_format), filename, media_type)


@router.post("/subject-assignments/import")
def import_subject_assignments(file: UploadFile = File(...), _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    return ok(SubjectAssignmentService(db).import_file(file), "Subject assignments imported")


@router.get("/subject-assignments/export")
def export_subject_assignments(file_format: str = "csv", search: str | None = None, sort: str | None = None, faculty_id: int | None = None, subject_id: int | None = None, section: str | None = None, academic_year: str | None = None, is_active: bool | None = None, _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db)):
    filename, media_type = _download_filename("subject_assignments", file_format)
    return _stream_bytes(SubjectAssignmentService(db).export(file_format, search=search, sort=sort, faculty_id=faculty_id, subject_id=subject_id, section=section, academic_year=academic_year, is_active=is_active), filename, media_type)


@router.get("/subject-assignments/template")
def template_subject_assignments(file_format: str = "csv", db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.ADMIN))):
    filename, media_type = _download_filename("subject_assignments_template", file_format)
    return _stream_bytes(SubjectAssignmentService(db).template(file_format), filename, media_type)


@router.post("/faculty/import")
def import_faculty(file: UploadFile = File(...), _: User = Depends(require_roles(UserRole.ADMIN)), db: Session = Depends(get_db)):
    return ok(FacultyService(db).import_file(file), "Faculty imported")


@router.get("/faculty/export")
def export_faculty(file_format: str = "csv", search: str | None = None, sort: str | None = None, department_id: int | None = None, _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db)):
    filename, media_type = _download_filename("faculty", file_format)
    return _stream_bytes(FacultyService(db).export(file_format, search=search, sort=sort, department_id=department_id), filename, media_type)


@router.get("/faculty/template")
def template_faculty(file_format: str = "csv", db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.ADMIN))):
    filename, media_type = _download_filename("faculty_template", file_format)
    return _stream_bytes(FacultyService(db).template(file_format), filename, media_type)


@router.post("/students/import")
def import_students(
    file: UploadFile = File(...),
    department_id: int | None = None,
    course_id: int | None = None,
    user: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return ok(StudentService(db).import_file(file, user, department_id=department_id, course_id=course_id), "Students imported")


@router.get("/students/export")
def export_students(file_format: str = "csv", search: str | None = None, sort: str | None = None, department_id: int | None = None, course_id: int | None = None, semester: int | None = None, section: str | None = None, batch: str | None = None, _: User = Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY)), db: Session = Depends(get_db)):
    filename, media_type = _download_filename("students", file_format)
    return _stream_bytes(StudentService(db).export(file_format, search=search, sort=sort, department_id=department_id, course_id=course_id, semester=semester, section=section, batch=batch), filename, media_type)


@router.get("/students/template")
def template_students(file_format: str = "csv", db: Session = Depends(get_db), _: User = Depends(require_roles(UserRole.FACULTY))):
    filename, media_type = _download_filename("students_template", file_format)
    return _stream_bytes(StudentService(db).template(file_format), filename, media_type)
