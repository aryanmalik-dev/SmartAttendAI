from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, Time, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import AttendanceSource, AttendanceStatus, NotificationStatus, SessionStatus, UserRole


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    faculty_profile: Mapped["Faculty | None"] = relationship(back_populates="user")
    student_profile: Mapped["Student | None"] = relationship(back_populates="user")


class Department(Base, TimestampMixin):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    description: Mapped[str | None] = mapped_column(Text)


class Faculty(Base, TimestampMixin):
    __tablename__ = "faculty"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    employee_id: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    designation: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    user: Mapped[User] = relationship(back_populates="faculty_profile")
    department: Mapped[Department] = relationship()


class Student(Base, TimestampMixin):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    student_number: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    enrollment_year: Mapped[int] = mapped_column(Integer)
    phone: Mapped[str | None] = mapped_column(String(40))
    guardian_email: Mapped[str | None] = mapped_column(String(255))
    low_attendance_threshold: Mapped[float] = mapped_column(Float, default=75)
    user: Mapped[User] = relationship(back_populates="student_profile")
    department: Mapped[Department] = relationship()
    embeddings: Mapped[list["FaceEmbedding"]] = relationship(back_populates="student", cascade="all, delete-orphan")


class Course(Base, TimestampMixin):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    faculty_id: Mapped[int | None] = mapped_column(ForeignKey("faculty.id"))
    semester: Mapped[str | None] = mapped_column(String(40))
    credits: Mapped[int] = mapped_column(Integer, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    department: Mapped[Department] = relationship()
    faculty: Mapped[Faculty | None] = relationship()


class Classroom(Base, TimestampMixin):
    __tablename__ = "classrooms"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    building: Mapped[str] = mapped_column(String(120))
    capacity: Mapped[int] = mapped_column(Integer)
    camera_url: Mapped[str | None] = mapped_column(String(500))


class AttendanceSession(Base, TimestampMixin):
    __tablename__ = "attendance_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    faculty_id: Mapped[int] = mapped_column(ForeignKey("faculty.id"))
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id"))
    session_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    status: Mapped[SessionStatus] = mapped_column(Enum(SessionStatus), default=SessionStatus.SCHEDULED)
    notes: Mapped[str | None] = mapped_column(Text)
    course: Mapped[Course] = relationship()
    faculty: Mapped[Faculty] = relationship()
    classroom: Mapped[Classroom] = relationship()
    records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class AttendanceRecord(Base, TimestampMixin):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_session_student"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("attendance_sessions.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    marked_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus), default=AttendanceStatus.PRESENT)
    confidence: Mapped[float | None] = mapped_column(Float)
    source: Mapped[AttendanceSource] = mapped_column(Enum(AttendanceSource), default=AttendanceSource.FACE)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    remarks: Mapped[str | None] = mapped_column(Text)
    session: Mapped[AttendanceSession] = relationship(back_populates="records")
    student: Mapped[Student] = relationship()
    marked_by: Mapped[User | None] = relationship()


class FaceEmbedding(Base, TimestampMixin):
    __tablename__ = "face_embeddings"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    embedding: Mapped[list[float]] = mapped_column(JSONB)
    image_path: Mapped[str | None] = mapped_column(String(500))
    model_name: Mapped[str] = mapped_column(String(80), default="buffalo_l")
    model_version: Mapped[str] = mapped_column(String(80), default="insightface")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    student: Mapped[Student] = relationship(back_populates="embeddings")


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    channel: Mapped[str] = mapped_column(String(40), default="email")
    subject: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[NotificationStatus] = mapped_column(Enum(NotificationStatus), default=NotificationStatus.PENDING)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user: Mapped[User | None] = relationship()


class SystemSetting(Base, TimestampMixin):
    __tablename__ = "system_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(120), unique=True)
    value: Mapped[dict] = mapped_column(JSONB)
    description: Mapped[str | None] = mapped_column(Text)
