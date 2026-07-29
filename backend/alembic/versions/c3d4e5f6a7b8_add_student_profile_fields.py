"""Add student profile fields

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-28 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("students", sa.Column("roll_no", sa.String(length=60), nullable=True))
    op.add_column("students", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column("students", sa.Column("student_mobile", sa.String(length=40), nullable=True))
    op.add_column("students", sa.Column("father_mobile", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("students", "father_mobile")
    op.drop_column("students", "student_mobile")
    op.drop_column("students", "date_of_birth")
    op.drop_column("students", "roll_no")
