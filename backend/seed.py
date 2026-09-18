from app.db.init_db import seed
from app.db.session import SessionLocal


def main():
    print("=" * 60)
    print("SmartAttend AI - Initial Database Seeding")
    print("=" * 60)
    db = SessionLocal()
    try:
        seed(db)
        print("✓ Database seeded successfully.")
        print("\nDefault Accounts:")
        print("  Admin   : admin@smartattend.ai   / Admin@123")
        print("  Faculty : faculty@smartattend.ai / Faculty@123")
        print("  Student : student@smartattend.ai / Student@123")
        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    main()
