from scripts.seed_admin import main as seed_admin


def main():
    print("Seeding database...\n")

    seed_admin()

    print("\nDone.")


if __name__ == "__main__":
    main()