"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = postgresql.ENUM("ADMIN", "FACULTY", "STUDENT", name="userrole", create_type=False)
    session_status = postgresql.ENUM("SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED", name="sessionstatus", create_type=False)
    attendance_status = postgresql.ENUM("PRESENT", "ABSENT", "LATE", "EXCUSED", name="attendancestatus", create_type=False)
    attendance_source = postgresql.ENUM("FACE", "MANUAL", "IMPORT", name="attendancesource", create_type=False)
    notification_status = postgresql.ENUM("PENDING", "SENT", "FAILED", name="notificationstatus", create_type=False)
    user_role.create(op.get_bind(), checkfirst=True)
    session_status.create(op.get_bind(), checkfirst=True)
    attendance_status.create(op.get_bind(), checkfirst=True)
    attendance_source.create(op.get_bind(), checkfirst=True)
    notification_status.create(op.get_bind(), checkfirst=True)

    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("email", sa.String(255), nullable=False), sa.Column("hashed_password", sa.String(255), nullable=False), sa.Column("full_name", sa.String(160), nullable=False), sa.Column("role", user_role, nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table("departments", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("code", sa.String(30), nullable=False), sa.Column("name", sa.String(160), nullable=False), sa.Column("description", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("code"), sa.UniqueConstraint("name"))
    op.create_table("faculty", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("employee_id", sa.String(60), nullable=False), sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id"), nullable=False), sa.Column("designation", sa.String(120)), sa.Column("phone", sa.String(40)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("user_id"), sa.UniqueConstraint("employee_id"))
    op.create_table("students", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("student_number", sa.String(60), nullable=False), sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id"), nullable=False), sa.Column("enrollment_year", sa.Integer(), nullable=False), sa.Column("phone", sa.String(40)), sa.Column("guardian_email", sa.String(255)), sa.Column("low_attendance_threshold", sa.Float(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("user_id"), sa.UniqueConstraint("student_number"))
    op.create_table("courses", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("code", sa.String(40), nullable=False), sa.Column("name", sa.String(180), nullable=False), sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id"), nullable=False), sa.Column("faculty_id", sa.Integer(), sa.ForeignKey("faculty.id")), sa.Column("semester", sa.String(40)), sa.Column("credits", sa.Integer(), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("code"))
    op.create_table("classrooms", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("building", sa.String(120), nullable=False), sa.Column("capacity", sa.Integer(), nullable=False), sa.Column("camera_url", sa.String(500)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("name"))
    op.create_table("attendance_sessions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False), sa.Column("faculty_id", sa.Integer(), sa.ForeignKey("faculty.id"), nullable=False), sa.Column("classroom_id", sa.Integer(), sa.ForeignKey("classrooms.id"), nullable=False), sa.Column("session_date", sa.Date(), nullable=False), sa.Column("start_time", sa.Time(), nullable=False), sa.Column("end_time", sa.Time()), sa.Column("status", session_status, nullable=False), sa.Column("notes", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_table("attendance_records", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("session_id", sa.Integer(), sa.ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False), sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False), sa.Column("marked_by_id", sa.Integer(), sa.ForeignKey("users.id")), sa.Column("status", attendance_status, nullable=False), sa.Column("confidence", sa.Float()), sa.Column("source", attendance_source, nullable=False), sa.Column("marked_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("remarks", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("session_id", "student_id", name="uq_session_student"))
    op.create_table("face_embeddings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False), sa.Column("embedding", postgresql.JSONB(), nullable=False), sa.Column("image_path", sa.String(500)), sa.Column("model_name", sa.String(80), nullable=False), sa.Column("model_version", sa.String(80), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_table("notifications", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id")), sa.Column("channel", sa.String(40), nullable=False), sa.Column("subject", sa.String(255), nullable=False), sa.Column("message", sa.Text(), nullable=False), sa.Column("status", notification_status, nullable=False), sa.Column("sent_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_table("system_settings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("key", sa.String(120), nullable=False), sa.Column("value", postgresql.JSONB(), nullable=False), sa.Column("description", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("key"))


def downgrade() -> None:
    for table in ["system_settings", "notifications", "face_embeddings", "attendance_records", "attendance_sessions", "classrooms", "courses", "students", "faculty", "departments", "users"]:
        op.drop_table(table)
    for name in ["notificationstatus", "attendancesource", "attendancestatus", "sessionstatus", "userrole"]:
        postgresql.ENUM(name=name).drop(op.get_bind(), checkfirst=True)
