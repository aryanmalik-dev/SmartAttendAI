from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import User, UserRoleAssignment
from app.models.enums import UserRole


ADMIN_EMAIL = "admin@smartattend.ai"
ADMIN_NAME = "System Administrator"
ADMIN_PASSWORD = "Admin@123"


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
            password_hash=hash_password(ADMIN_PASSWORD),
            is_active=True,
            email_verified=True,
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
        print(f"Email   : {ADMIN_EMAIL}")
        print(f"Password: {ADMIN_PASSWORD}")
        print("Status  : Active")
        print("=" * 50)

    finally:
        db.close()


if __name__ == "__main__":
    main()