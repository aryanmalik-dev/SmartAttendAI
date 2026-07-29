"""Adjust academic hierarchy so departments attach to courses

Revision ID: 6f1b1a8f9c2d
Revises: 42787a0a5d0e
Create Date: 2026-07-28 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "6f1b1a8f9c2d"
down_revision: Union[str, None] = "42787a0a5d0e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("course_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_departments_course_id"), "departments", ["course_id"], unique=False)
    op.create_foreign_key("fk_departments_course_id_courses", "departments", "courses", ["course_id"], ["id"])
    op.alter_column("courses", "department_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column("courses", "department_id", existing_type=sa.Integer(), nullable=False)
    op.drop_constraint("fk_departments_course_id_courses", "departments", type_="foreignkey")
    op.drop_index(op.f("ix_departments_course_id"), table_name="departments")
    op.drop_column("departments", "course_id")
