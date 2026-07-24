from app.db.init_db import seed
from app.db.session import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        seed(db)
        print("Seed data inserted")
    finally:
        db.close()


if __name__ == "__main__":
    main()
