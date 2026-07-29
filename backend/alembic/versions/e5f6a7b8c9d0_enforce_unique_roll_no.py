"""Enforce unique and non-nullable roll_no on students

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-29 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("students", "roll_no", existing_type=sa.String(length=60), nullable=False)
    op.create_index(op.f("ix_students_roll_no"), "students", ["roll_no"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_students_roll_no"), table_name="students")
    op.alter_column("students", "roll_no", existing_type=sa.String(length=60), nullable=True)
