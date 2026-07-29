from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.entities import Classroom, Course, Department, Faculty, Student, User, UserRoleAssignment
from app.models.enums import UserRole


def seed(db: Session) -> None:
    if db.scalar(select(User).where(User.email == "admin@smartattend.edu")):
        return
    btech = Course(name="Bachelor of Technology", abbreviation="BTech", duration_years=4, is_active=True)
    db.add(btech)
    db.flush()

    cse = Department(abbreviation="CSE", name="Computer Science and Engineering", description="Computer science and AI programs", course_id=btech.id, low_attendance_threshold=75.0)
    ece = Department(abbreviation="ECE", name="Electronics and Communication Engineering", description="Electronics and communication", course_id=btech.id, low_attendance_threshold=75.0)
    db.add_all([cse, ece])
    db.flush()

    admin = User(email="admin@smartattend.edu", full_name="System Admin", password_hash=hash_password("Admin@12345"), is_active=True, email_verified=True)
    faculty_user = User(email="faculty@smartattend.edu", full_name="Dr. Asha Rao", password_hash=hash_password("Faculty@12345"), is_active=True, email_verified=True)
    student_user = User(email="student@smartattend.edu", full_name="Riya Sharma", password_hash=hash_password("Student@12345"), is_active=True, email_verified=True)
    db.add_all([admin, faculty_user, student_user])
    db.flush()
    db.add_all([
        UserRoleAssignment(user_id=admin.id, role=UserRole.ADMIN),
        UserRoleAssignment(user_id=faculty_user.id, role=UserRole.FACULTY),
        UserRoleAssignment(user_id=student_user.id, role=UserRole.STUDENT),
    ])
    faculty = Faculty(user_id=faculty_user.id, employee_id="FAC-1001", department_id=cse.id, designation="Associate Professor", phone="+91-9000000001")
    student = Student(
        user_id=student_user.id,
        student_number="STU-2026-001",
        roll_no="101",
        date_of_birth=date(2005, 7, 15),
        student_mobile="+91-9000000003",
        father_mobile="+91-9000000004",
        department_id=cse.id,
        enrollment_year=2026,
        guardian_email="guardian@example.com",
    )
    db.add_all([faculty, student])
    db.flush()

    db.add_all([
        Classroom(name="AI Lab 1", building="Innovation Block", capacity=72, camera_url=None),
    ])
    db.commit()
