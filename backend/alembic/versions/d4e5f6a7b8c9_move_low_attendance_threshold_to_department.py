"""Move low attendance threshold from students to departments

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-29 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "departments",
        sa.Column("low_attendance_threshold", sa.Float(), server_default=sa.text("75"), nullable=False),
    )
    op.drop_column("students", "low_attendance_threshold")


def downgrade() -> None:
    op.add_column(
        "students",
        sa.Column("low_attendance_threshold", sa.Float(), server_default=sa.text("75"), nullable=False),
    )
    op.drop_column("departments", "low_attendance_threshold")
