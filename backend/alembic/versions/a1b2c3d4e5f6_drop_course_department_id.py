"""Drop legacy courses.department_id column

Revision ID: a1b2c3d4e5f6
Revises: 6f1b1a8f9c2d
Create Date: 2026-07-28 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "6f1b1a8f9c2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_courses_department_id"), table_name="courses")
    op.drop_column("courses", "department_id")


def downgrade() -> None:
    op.add_column("courses", sa.Column("department_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_courses_department_id"), "courses", ["department_id"], unique=False)
    op.create_foreign_key("fk_courses_department_id_departments", "courses", "departments", ["department_id"], ["id"])
