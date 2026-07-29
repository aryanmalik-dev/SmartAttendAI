from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, Time, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import AttendanceSource, AttendanceStatus, NotificationStatus, SessionStatus, UserRole


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserRoleAssignment(Base):
    __tablename__ = "user_role_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole),
        nullable=False,
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(
        back_populates="roles",
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "role",
            name="uq_user_role",
        ),
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    faculty_profile: Mapped[Faculty | None] = relationship(back_populates="user")
    student_profile: Mapped[Student | None] = relationship(back_populates="user")

    roles: Mapped[list[UserRoleAssignment]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    email_verified: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    activation_tokens: Mapped[list[ActivationToken]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    attendance_records_marked: Mapped[list[AttendanceRecord]] = relationship(
        foreign_keys="AttendanceRecord.marked_by_id",
        back_populates="marked_by",
    )

    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user"
    )


class Department(Base, TimestampMixin):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(primary_key=True)
    abbreviation: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), nullable=True, index=True)
    low_attendance_threshold: Mapped[float] = mapped_column(default=75.0, nullable=False)
    course: Mapped[Course | None] = relationship(
        back_populates="departments",
        foreign_keys=[course_id],
    )
    subjects: Mapped[list[Subject]] = relationship(
        back_populates="department",
    )

    students: Mapped[list[Student]] = relationship(
        back_populates="department"
    )

    faculty_members: Mapped[list[Faculty]] = relationship(
        back_populates="department"
    )


class Faculty(Base, TimestampMixin):
    __tablename__ = "faculty"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    employee_id: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    designation: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    user: Mapped[User] = relationship(back_populates="faculty_profile")
    department: Mapped[Department] = relationship(back_populates="faculty_members")
    subject_assignments: Mapped[list[SubjectAssignment]] = relationship(
        back_populates="faculty",
    )


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    student_number: Mapped[str] = mapped_column(
        String(60),
        unique=True,
        index=True,
        nullable=False,
    )

    roll_no: Mapped[str] = mapped_column(
        String(60),
        unique=True,
        index=True,
        nullable=False,
    )

    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
    )

    student_mobile: Mapped[str | None] = mapped_column(
        String(40),
    )

    father_mobile: Mapped[str | None] = mapped_column(
        String(40),
    )

    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.id"),
        nullable=False,
        index=True,
    )

    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"),
        nullable=False,
        index=True,
    )

    enrollment_year: Mapped[int] = mapped_column(
        nullable=False,
    )

    semester: Mapped[int] = mapped_column(
        nullable=False,
    )

    section: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )

    batch: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )

    phone: Mapped[str | None] = mapped_column(
        String(40),
    )

    guardian_email: Mapped[str | None] = mapped_column(
        String(255),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(
        back_populates="student_profile",
    )

    department: Mapped[Department] = relationship(
        back_populates="students",
    )

    course: Mapped[Course] = relationship(
        back_populates="students",
    )

    face_embeddings: Mapped[list[FaceEmbedding]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
    )

    attendance_records: Mapped[list[AttendanceRecord]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
    )

    @property
    def admission_no(self) -> str:
        return self.student_number

    @property
    def full_name(self) -> str:
        return self.user.full_name if self.user else ""

    @property
    def email(self) -> str:
        return self.user.email if self.user else ""


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(
        String(180),
        unique=True,
        nullable=False,
    )

    abbreviation: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        index=True,
        nullable=False,
    )

    duration_years: Mapped[int] = mapped_column(
        nullable=False,
        default=4,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    departments: Mapped[list[Department]] = relationship(
        back_populates="course",
        foreign_keys="Department.course_id",
    )

    subjects: Mapped[list[Subject]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
    )

    students: Mapped[list[Student]] = relationship(
        back_populates="course",
    )


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)

    code: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        index=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(180),
        nullable=False,
    )

    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"),
        nullable=False,
        index=True,
    )

    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.id"),
        nullable=False,
        index=True,
    )

    semester: Mapped[int] = mapped_column(
        nullable=False,
    )

    credits: Mapped[int] = mapped_column(
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    course: Mapped[Course] = relationship(
        back_populates="subjects"
    )

    department: Mapped[Department] = relationship(
        back_populates="subjects",
    )

    subject_assignments: Mapped[list[SubjectAssignment]] = relationship(
        back_populates="subject",
    )


class SubjectAssignment(Base):
    __tablename__ = "subject_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)

    faculty_id: Mapped[int] = mapped_column(
        ForeignKey("faculty.id"),
        nullable=False,
        index=True,
    )

    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id"),
        nullable=False,
        index=True,
    )

    section: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )

    academic_year: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    faculty: Mapped[Faculty] = relationship(
        back_populates="subject_assignments",
    )

    subject: Mapped[Subject] = relationship(
        back_populates="subject_assignments",
    )

    attendance_sessions: Mapped[list[AttendanceSession]] = relationship(
        back_populates="subject_assignment",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint(
            "faculty_id",
            "subject_id",
            "section",
            "academic_year",
            name="uq_subject_assignment",
        ),
    )


class Classroom(Base, TimestampMixin):
    __tablename__ = "classrooms"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    building: Mapped[str] = mapped_column(String(120))
    capacity: Mapped[int] = mapped_column(Integer)
    camera_url: Mapped[str | None] = mapped_column(String(500))
    attendance_sessions: Mapped[list[AttendanceSession]] = relationship(
        back_populates="classroom",
    )


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)

    subject_assignment_id: Mapped[int] = mapped_column(
        ForeignKey("subject_assignments.id"),
        nullable=False,
        index=True,
    )

    classroom_id: Mapped[int] = mapped_column(
        ForeignKey("classrooms.id"),
        nullable=False,
        index=True,
    )

    session_date: Mapped[date] = mapped_column(
        nullable=False,
        index=True,
    )

    start_time: Mapped[time] = mapped_column(
        nullable=False,
    )

    end_time: Mapped[time | None] = mapped_column()

    status: Mapped[SessionStatus] = mapped_column(
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    subject_assignment: Mapped[SubjectAssignment] = relationship(
        back_populates="attendance_sessions",
    )

    classroom: Mapped[Classroom] = relationship(
        back_populates="attendance_sessions",
    )

    attendance_records: Mapped[list[AttendanceRecord]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )


class AttendanceRecord(Base, TimestampMixin):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_session_student"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("attendance_sessions.id", ondelete="CASCADE"), index=True, nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True, nullable=False)
    marked_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus), default=AttendanceStatus.PRESENT)
    confidence: Mapped[float | None] = mapped_column(Float)
    source: Mapped[AttendanceSource] = mapped_column(Enum(AttendanceSource), default=AttendanceSource.FACE)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    session: Mapped[AttendanceSession] = relationship(back_populates="attendance_records")
    student: Mapped[Student] = relationship(back_populates="attendance_records")
    marked_by: Mapped[User | None] = relationship(
        back_populates="attendance_records_marked",
    )


class FaceEmbedding(Base, TimestampMixin):
    __tablename__ = "face_embeddings"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    embedding: Mapped[list[float]] = mapped_column(JSONB)
    image_path: Mapped[str | None] = mapped_column(String(500))
    model_name: Mapped[str] = mapped_column(String(80), default="buffalo_l")
    model_version: Mapped[str] = mapped_column(String(80), default="insightface")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    student: Mapped[Student] = relationship(back_populates="face_embeddings")


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    channel: Mapped[str] = mapped_column(String(40), default="email")
    subject: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[NotificationStatus] = mapped_column(Enum(NotificationStatus), default=NotificationStatus.PENDING)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user: Mapped["User"] = relationship(
        back_populates="notifications",
    )


class SystemSetting(Base, TimestampMixin):
    __tablename__ = "system_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(120), unique=True)
    value: Mapped[dict] = mapped_column(JSONB)
    description: Mapped[str | None] = mapped_column(Text)


class ActivationToken(Base, TimestampMixin):
    __tablename__ = "activation_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    token: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    used: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    user: Mapped[User] = relationship(
        back_populates="activation_tokens",
    )


class PasswordResetToken(Base, TimestampMixin):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    token: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    used: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        back_populates="password_reset_tokens"
    )
