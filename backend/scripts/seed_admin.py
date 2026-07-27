from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.entities import User, UserRoleAssignment
from app.models.enums import UserRole


ADMIN_EMAIL = "admin@smartattend.ai"
ADMIN_NAME = "System Administrator"


def main():
    db = SessionLocal()

    try:
        existing = db.scalar(
            select(User).where(User.email == ADMIN_EMAIL)
        )

        if existing:
            print("✓ Admin already exists.")
            return

        admin = User(
            email=ADMIN_EMAIL,
            full_name=ADMIN_NAME,
            password_hash=None,
            is_active=False,
            email_verified=False,
        )

        db.add(admin)
        db.flush()

        db.add(
            UserRoleAssignment(
                user_id=admin.id,
                role=UserRole.ADMIN,
            )
        )

        db.commit()

        print("=" * 50)
        print("Admin created successfully.")
        print(f"Email : {ADMIN_EMAIL}")
        print("Status: Inactive (awaiting activation)")
        print("=" * 50)

    finally:
        db.close()


if __name__ == "__main__":
    main()