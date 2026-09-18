from app.db.init_db import seed
from app.db.session import SessionLocal
from scripts.seed_admin import main as seed_admin


def main():
    print("Seeding database...\n")
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    seed_admin()
    print("\nDone.")


if __name__ == "__main__":
    main()