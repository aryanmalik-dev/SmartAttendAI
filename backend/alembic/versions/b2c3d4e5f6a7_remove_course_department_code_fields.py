"""Remove course code and rename department code to abbreviation

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-28 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_courses_code"), table_name="courses")
    op.drop_column("courses", "code")

    op.drop_index(op.f("ix_departments_code"), table_name="departments")
    op.alter_column(
        "departments",
        "code",
        new_column_name="abbreviation",
        existing_type=sa.String(length=30),
        existing_nullable=False,
    )
    op.create_index(op.f("ix_courses_abbreviation"), "courses", ["abbreviation"], unique=True)
    op.create_index(op.f("ix_departments_abbreviation"), "departments", ["abbreviation"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_departments_abbreviation"), table_name="departments")
    op.alter_column(
        "departments",
        "abbreviation",
        new_column_name="code",
        existing_type=sa.String(length=30),
        existing_nullable=False,
    )
    op.create_index(op.f("ix_departments_code"), "departments", ["code"], unique=True)

    op.drop_index(op.f("ix_courses_abbreviation"), table_name="courses")
    op.add_column("courses", sa.Column("code", sa.String(length=40), nullable=True))
    op.create_index(op.f("ix_courses_code"), "courses", ["code"], unique=True)
