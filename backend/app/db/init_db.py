from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.entities import Classroom, Course, Department, Faculty, Student, User
from app.models.enums import UserRole


def seed(db: Session) -> None:
    if db.scalar(select(User).where(User.email == "admin@smartattend.edu")):
        return
    cse = Department(code="CSE", name="Computer Science", description="Computer science and AI programs")
    ece = Department(code="ECE", name="Electronics", description="Electronics and communication")
    db.add_all([cse, ece])
    db.flush()
    admin = User(email="admin@smartattend.edu", full_name="System Admin", hashed_password=hash_password("Admin@12345"), role=UserRole.ADMIN)
    faculty_user = User(email="faculty@smartattend.edu", full_name="Dr. Asha Rao", hashed_password=hash_password("Faculty@12345"), role=UserRole.FACULTY)
    student_user = User(email="student@smartattend.edu", full_name="Riya Sharma", hashed_password=hash_password("Student@12345"), role=UserRole.STUDENT)
    db.add_all([admin, faculty_user, student_user])
    db.flush()
    faculty = Faculty(user_id=faculty_user.id, employee_id="FAC-1001", department_id=cse.id, designation="Associate Professor", phone="+91-9000000001")
    student = Student(user_id=student_user.id, student_number="STU-2026-001", department_id=cse.id, enrollment_year=2026, guardian_email="guardian@example.com")
    db.add_all([faculty, student])
    db.flush()
    db.add_all([
        Course(code="CS501", name="Applied Machine Learning", department_id=cse.id, faculty_id=faculty.id, semester="V", credits=4),
        Course(code="CS502", name="Computer Vision", department_id=cse.id, faculty_id=faculty.id, semester="V", credits=3),
        Classroom(name="AI Lab 1", building="Innovation Block", capacity=72, camera_url=None),
    ])
    db.commit()
