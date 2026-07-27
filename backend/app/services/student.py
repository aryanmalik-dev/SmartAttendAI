from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Student, User, UserRoleAssignment
from app.models.enums import UserRole
from app.schemas.student import StudentCreate, StudentUpdate


class StudentService:

    def __init__(self, db: Session):
        self.db = db

    def create_student(self, data: StudentCreate):
        if self.db.scalar(select(User).where(User.email == data.email)):
            raise HTTPException(
                status_code=400,
                detail="Email already exists",
            )

        if self.db.scalar(
            select(Student).where(
                Student.student_number == data.student_number
            )
        ):
            raise HTTPException(
                status_code=400,
                detail="Student number already exists",
            )

        user = User(
            email=data.email,
            full_name=data.full_name,
            password_hash=None,
            is_active=False,
            email_verified=False,
        )

        self.db.add(user)
        self.db.flush()

        self.db.add(
            UserRoleAssignment(
                user_id=user.id,
                role=UserRole.STUDENT,
            )
        )

        student = Student(
            user_id=user.id,
            student_number=data.student_number,
            department_id=data.department_id,
            course_id=data.course_id,
            enrollment_year=data.enrollment_year,
            semester=data.semester,
            section=data.section,
            batch=data.batch,
            phone=data.phone,
            guardian_email=data.guardian_email,
        )

        self.db.add(student)
        self.db.commit()
        self.db.refresh(student)

        return student

    def list_students(self):
        return self.db.scalars(
            select(Student).order_by(Student.student_number)
        ).all()

    def get_student(self, student_id: int):
        student = self.db.get(Student, student_id)

        if not student:
            raise HTTPException(
                status_code=404,
                detail="Student not found",
            )

        return student

    def update_student(
        self,
        student_id: int,
        data: StudentUpdate,
    ):
        student = self.get_student(student_id)

        values = data.model_dump(exclude_unset=True)

        if "full_name" in values:
            student.user.full_name = values.pop("full_name")

        for key, value in values.items():
            setattr(student, key, value)

        self.db.commit()
        self.db.refresh(student)

        return student

    def delete_student(self, student_id: int):
        student = self.get_student(student_id)

        self.db.delete(student.user)

        self.db.commit()