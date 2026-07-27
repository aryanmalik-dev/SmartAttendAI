from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.entities import Classroom, Course, Department, Faculty, Student, Subject, User
from app.schemas.search import SearchResultOut


class SearchService:
    def __init__(self, db: Session):
        self.db = db

    def _student_matches(self, query: str, limit: int) -> list[dict]:
        student_user = User
        rows = self.db.execute(
            select(
                Student.id.label("id"),
                student_user.full_name.label("title"),
                Student.student_number.label("subtitle"),
                Department.name.label("department_name"),
                Course.name.label("course_name"),
            )
            .select_from(Student)
            .join(student_user, Student.user_id == student_user.id)
            .join(Department, Student.department_id == Department.id)
            .join(Course, Student.course_id == Course.id)
            .where(
                or_(
                    student_user.full_name.ilike(query),
                    student_user.email.ilike(query),
                    Student.student_number.ilike(query),
                )
            )
            .limit(limit)
        ).mappings().all()
        return [
            SearchResultOut(
                entity_type="student",
                id=row["id"],
                title=row["title"],
                subtitle=row["subtitle"],
                meta={"department": row["department_name"], "course": row["course_name"]},
            ).model_dump(mode="json")
            for row in rows
        ]

    def _faculty_matches(self, query: str, limit: int) -> list[dict]:
        faculty_user = User
        rows = self.db.execute(
            select(
                Faculty.id.label("id"),
                faculty_user.full_name.label("title"),
                Faculty.employee_id.label("subtitle"),
                Department.name.label("department_name"),
            )
            .select_from(Faculty)
            .join(faculty_user, Faculty.user_id == faculty_user.id)
            .join(Department, Faculty.department_id == Department.id)
            .where(
                or_(
                    faculty_user.full_name.ilike(query),
                    faculty_user.email.ilike(query),
                    Faculty.employee_id.ilike(query),
                    Department.name.ilike(query),
                )
            )
            .limit(limit)
        ).mappings().all()
        return [
            SearchResultOut(
                entity_type="faculty",
                id=row["id"],
                title=row["title"],
                subtitle=row["subtitle"],
                meta={"department": row["department_name"]},
            ).model_dump(mode="json")
            for row in rows
        ]

    def _subject_matches(self, query: str, limit: int) -> list[dict]:
        rows = self.db.execute(
            select(
                Subject.id.label("id"),
                Subject.name.label("title"),
                Subject.code.label("subtitle"),
                Course.name.label("course_name"),
                Department.name.label("department_name"),
            )
            .select_from(Subject)
            .join(Course, Subject.course_id == Course.id)
            .join(Department, Subject.department_id == Department.id)
            .where(
                or_(
                    Subject.name.ilike(query),
                    Subject.code.ilike(query),
                    Course.name.ilike(query),
                    Department.name.ilike(query),
                )
            )
            .limit(limit)
        ).mappings().all()
        return [
            SearchResultOut(
                entity_type="subject",
                id=row["id"],
                title=row["title"],
                subtitle=row["subtitle"],
                meta={"course": row["course_name"], "department": row["department_name"]},
            ).model_dump(mode="json")
            for row in rows
        ]

    def _department_matches(self, query: str, limit: int) -> list[dict]:
        rows = self.db.execute(
            select(
                Department.id.label("id"),
                Department.name.label("title"),
                Department.code.label("subtitle"),
            )
            .where(or_(Department.name.ilike(query), Department.code.ilike(query), Department.description.ilike(query)))
            .limit(limit)
        ).mappings().all()
        return [
            SearchResultOut(entity_type="department", id=row["id"], title=row["title"], subtitle=row["subtitle"]).model_dump(mode="json")
            for row in rows
        ]

    def _course_matches(self, query: str, limit: int) -> list[dict]:
        rows = self.db.execute(
            select(
                Course.id.label("id"),
                Course.name.label("title"),
                Course.code.label("subtitle"),
                Department.name.label("department_name"),
            )
            .select_from(Course)
            .join(Department, Course.department_id == Department.id)
            .where(or_(Course.name.ilike(query), Course.code.ilike(query), Course.abbreviation.ilike(query), Department.name.ilike(query)))
            .limit(limit)
        ).mappings().all()
        return [
            SearchResultOut(
                entity_type="course",
                id=row["id"],
                title=row["title"],
                subtitle=row["subtitle"],
                meta={"department": row["department_name"]},
            ).model_dump(mode="json")
            for row in rows
        ]

    def _classroom_matches(self, query: str, limit: int) -> list[dict]:
        rows = self.db.execute(
            select(
                Classroom.id.label("id"),
                Classroom.name.label("title"),
                Classroom.building.label("subtitle"),
            )
            .where(or_(Classroom.name.ilike(query), Classroom.building.ilike(query), Classroom.camera_url.ilike(query)))
            .limit(limit)
        ).mappings().all()
        return [
            SearchResultOut(entity_type="classroom", id=row["id"], title=row["title"], subtitle=row["subtitle"]).model_dump(mode="json")
            for row in rows
        ]

    def search(self, query: str, limit: int = 20) -> dict:
        pattern = f"%{query.strip()}%"
        per_entity = max(limit // 6, 1)
        items = (
            self._student_matches(pattern, per_entity)
            + self._faculty_matches(pattern, per_entity)
            + self._subject_matches(pattern, per_entity)
            + self._department_matches(pattern, per_entity)
            + self._course_matches(pattern, per_entity)
            + self._classroom_matches(pattern, per_entity)
        )
        return {"query": query, "total": len(items), "items": items[:limit]}
