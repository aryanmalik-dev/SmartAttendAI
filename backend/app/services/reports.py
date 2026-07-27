from __future__ import annotations

from collections import Counter
from datetime import date, timedelta
from io import BytesIO

import pandas as pd
from fastapi import HTTPException
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy import and_, case, desc, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.models.entities import AttendanceRecord, AttendanceSession, Course, Department, Faculty, Student, Subject, SubjectAssignment, User
from app.models.enums import AttendanceStatus
from app.schemas.reports import AttendanceReportFilters
from app.services.data_io import dataframe_to_csv_bytes, dataframe_to_excel_bytes


def _status_counts(records: list[AttendanceRecord]) -> dict[str, int]:
    counts = Counter(record.status.value for record in records)
    return {
        "present": counts.get(AttendanceStatus.PRESENT.value, 0),
        "absent": counts.get(AttendanceStatus.ABSENT.value, 0),
        "late": counts.get(AttendanceStatus.LATE.value, 0),
        "excused": counts.get(AttendanceStatus.EXCUSED.value, 0),
    }


def _percentage(present: int, late: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(((present + late) / total) * 100, 2)


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def _student_or_404(self, student_id: int) -> Student:
        student = self.db.get(Student, student_id)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        return student

    def _course_or_404(self, course_id: int) -> Course:
        course = self.db.get(Course, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        return course

    def _department_or_404(self, department_id: int) -> Department:
        department = self.db.get(Department, department_id)
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        return department

    def _subject_or_404(self, subject_id: int) -> Subject:
        subject = self.db.get(Subject, subject_id)
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        return subject

    def _faculty_or_404(self, faculty_id: int) -> Faculty:
        faculty = self.db.get(Faculty, faculty_id)
        if not faculty:
            raise HTTPException(status_code=404, detail="Faculty not found")
        return faculty

    def _session_or_404(self, session_id: int) -> AttendanceSession:
        session = self.db.get(AttendanceSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Attendance session not found")
        return session

    def _parse_status(self, value: str | None) -> AttendanceStatus | None:
        if not value:
            return None
        try:
            return AttendanceStatus(value)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid attendance status") from exc

    def _order_stmt(self, stmt, sort: str | None, mapping: dict[str, object], default_column):
        if not sort:
            return stmt.order_by(default_column.asc())
        field, _, direction = sort.partition(":")
        column = mapping.get(field, default_column)
        if direction.lower() == "desc":
            return stmt.order_by(desc(column))
        return stmt.order_by(column.asc())

    def _page(self, stmt, page: int, size: int) -> tuple[list[dict], int]:
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self.db.execute(stmt.offset((page - 1) * size).limit(size)).mappings().all()
        return [dict(row) for row in rows], total

    def _status_summary_rows(self, rows: list[dict], scope: str, **extra) -> dict:
        counts = Counter(str(row.get("status")) for row in rows)
        total = len(rows)
        return {
            "scope": scope,
            "total_records": total,
            "present": counts.get(AttendanceStatus.PRESENT.value, 0),
            "absent": counts.get(AttendanceStatus.ABSENT.value, 0),
            "late": counts.get(AttendanceStatus.LATE.value, 0),
            "excused": counts.get(AttendanceStatus.EXCUSED.value, 0),
            "attendance_percentage": _percentage(
                counts.get(AttendanceStatus.PRESENT.value, 0),
                counts.get(AttendanceStatus.LATE.value, 0),
                total,
            ),
            **extra,
        }

    def _records_stmt(
        self,
        *,
        student_id: int | None = None,
        search: str | None = None,
        department_id: int | None = None,
        course_id: int | None = None,
        subject_id: int | None = None,
        faculty_id: int | None = None,
        semester: int | None = None,
        section: str | None = None,
        batch: str | None = None,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ):
        student_user = aliased(User)
        faculty_user = aliased(User)
        stmt = (
            select(
                AttendanceRecord.id.label("record_id"),
                AttendanceSession.id.label("session_id"),
                AttendanceSession.session_date,
                AttendanceSession.start_time,
                AttendanceSession.end_time,
                Student.id.label("student_id"),
                Student.student_number,
                student_user.full_name.label("student_name"),
                Department.id.label("department_id"),
                Department.name.label("department_name"),
                Course.id.label("course_id"),
                Course.code.label("course_code"),
                Course.name.label("course_name"),
                Subject.id.label("subject_id"),
                Subject.code.label("subject_code"),
                Subject.name.label("subject_name"),
                Faculty.id.label("faculty_id"),
                faculty_user.full_name.label("faculty_name"),
                AttendanceRecord.status.label("status"),
                AttendanceRecord.confidence.label("confidence"),
                AttendanceRecord.source.label("source"),
                AttendanceRecord.marked_at.label("marked_at"),
                AttendanceRecord.remarks.label("remarks"),
            )
            .select_from(AttendanceRecord)
            .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
            .join(SubjectAssignment, AttendanceSession.subject_assignment_id == SubjectAssignment.id)
            .join(Subject, SubjectAssignment.subject_id == Subject.id)
            .join(Course, Subject.course_id == Course.id)
            .join(Department, Subject.department_id == Department.id)
            .join(Faculty, SubjectAssignment.faculty_id == Faculty.id)
            .join(faculty_user, Faculty.user_id == faculty_user.id)
            .join(Student, AttendanceRecord.student_id == Student.id)
            .join(student_user, Student.user_id == student_user.id)
        )

        conditions = []
        if search:
            term = f"%{search}%"
            conditions.append(
                or_(
                    student_user.full_name.ilike(term),
                    Student.student_number.ilike(term),
                    faculty_user.full_name.ilike(term),
                    Subject.code.ilike(term),
                    Subject.name.ilike(term),
                    Course.code.ilike(term),
                    Course.name.ilike(term),
                    Department.name.ilike(term),
                )
            )
        if department_id is not None:
            conditions.append(Department.id == department_id)
        if student_id is not None:
            conditions.append(Student.id == student_id)
        if course_id is not None:
            conditions.append(Course.id == course_id)
        if subject_id is not None:
            conditions.append(Subject.id == subject_id)
        if faculty_id is not None:
            conditions.append(Faculty.id == faculty_id)
        if semester is not None:
            conditions.append(Subject.semester == semester)
        if section is not None:
            conditions.append(SubjectAssignment.section == section)
        if batch is not None:
            conditions.append(Student.batch == batch)
        if status is not None:
            conditions.append(AttendanceRecord.status == self._parse_status(status))
        if start_date is not None:
            conditions.append(AttendanceSession.session_date >= start_date)
        if end_date is not None:
            conditions.append(AttendanceSession.session_date <= end_date)

        if conditions:
            stmt = stmt.where(and_(*conditions))
        return stmt

    def attendance_records(
        self,
        *,
        page: int = 1,
        size: int = 20,
        student_id: int | None = None,
        search: str | None = None,
        sort: str | None = None,
        department_id: int | None = None,
        course_id: int | None = None,
        subject_id: int | None = None,
        faculty_id: int | None = None,
        semester: int | None = None,
        section: str | None = None,
        batch: str | None = None,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> tuple[list[dict], int]:
        stmt = self._records_stmt(
            student_id=student_id,
            search=search,
            department_id=department_id,
            course_id=course_id,
            subject_id=subject_id,
            faculty_id=faculty_id,
            semester=semester,
            section=section,
            batch=batch,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )
        stmt = self._order_stmt(
            stmt,
            sort,
            {
                "record_id": stmt.selected_columns.record_id,
                "session_date": stmt.selected_columns.session_date,
                "student_name": stmt.selected_columns.student_name,
                "student_number": stmt.selected_columns.student_number,
                "faculty_name": stmt.selected_columns.faculty_name,
                "subject_code": stmt.selected_columns.subject_code,
                "marked_at": stmt.selected_columns.marked_at,
                "confidence": stmt.selected_columns.confidence,
                "status": stmt.selected_columns.status,
            },
            AttendanceRecord.marked_at,
        )
        return self._page(stmt, page, size)

    def _student_counts_subquery(
        self,
        *,
        department_id: int | None = None,
        course_id: int | None = None,
        subject_id: int | None = None,
        faculty_id: int | None = None,
        semester: int | None = None,
        section: str | None = None,
        batch: str | None = None,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ):
        stmt = (
            select(
                AttendanceRecord.student_id.label("student_id"),
                func.count(AttendanceRecord.id).label("total_sessions"),
                func.sum(case((AttendanceRecord.status == AttendanceStatus.PRESENT, 1), else_=0)).label("present"),
                func.sum(case((AttendanceRecord.status == AttendanceStatus.ABSENT, 1), else_=0)).label("absent"),
                func.sum(case((AttendanceRecord.status == AttendanceStatus.LATE, 1), else_=0)).label("late"),
                func.sum(case((AttendanceRecord.status == AttendanceStatus.EXCUSED, 1), else_=0)).label("excused"),
            )
            .select_from(AttendanceRecord)
            .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
            .join(SubjectAssignment, AttendanceSession.subject_assignment_id == SubjectAssignment.id)
            .join(Subject, SubjectAssignment.subject_id == Subject.id)
            .join(Course, Subject.course_id == Course.id)
            .join(Department, Subject.department_id == Department.id)
            .join(Faculty, SubjectAssignment.faculty_id == Faculty.id)
            .join(Student, AttendanceRecord.student_id == Student.id)
        )

        conditions = []
        if department_id is not None:
            conditions.append(Department.id == department_id)
        if course_id is not None:
            conditions.append(Course.id == course_id)
        if subject_id is not None:
            conditions.append(Subject.id == subject_id)
        if faculty_id is not None:
            conditions.append(Faculty.id == faculty_id)
        if semester is not None:
            conditions.append(Subject.semester == semester)
        if section is not None:
            conditions.append(SubjectAssignment.section == section)
        if batch is not None:
            conditions.append(Student.batch == batch)
        if status is not None:
            conditions.append(AttendanceRecord.status == self._parse_status(status))
        if start_date is not None:
            conditions.append(AttendanceSession.session_date >= start_date)
        if end_date is not None:
            conditions.append(AttendanceSession.session_date <= end_date)

        if conditions:
            stmt = stmt.where(and_(*conditions))
        return stmt.group_by(AttendanceRecord.student_id).subquery()

    def student_summaries(
        self,
        *,
        page: int = 1,
        size: int = 20,
        student_id: int | None = None,
        search: str | None = None,
        sort: str | None = None,
        department_id: int | None = None,
        course_id: int | None = None,
        semester: int | None = None,
        section: str | None = None,
        batch: str | None = None,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> tuple[list[dict], int]:
        student_user = aliased(User)
        counts = self._student_counts_subquery(
            department_id=department_id,
            course_id=course_id,
            semester=semester,
            section=section,
            batch=batch,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )
        counts_alias = counts.c
        attendance_percentage = func.coalesce(
            (func.coalesce(counts_alias.present, 0) + func.coalesce(counts_alias.late, 0)) * 100.0 / func.nullif(counts_alias.total_sessions, 0),
            0.0,
        ).label("attendance_percentage")

        stmt = (
            select(
                Student.id.label("student_id"),
                Student.student_number,
                student_user.full_name.label("student_name"),
                Department.id.label("department_id"),
                Department.name.label("department_name"),
                Course.id.label("course_id"),
                Course.name.label("course_name"),
                Student.semester,
                Student.section,
                Student.batch,
                func.coalesce(counts_alias.total_sessions, 0).label("total_sessions"),
                func.coalesce(counts_alias.present, 0).label("present"),
                func.coalesce(counts_alias.absent, 0).label("absent"),
                func.coalesce(counts_alias.late, 0).label("late"),
                func.coalesce(counts_alias.excused, 0).label("excused"),
                attendance_percentage,
            )
            .select_from(Student)
            .join(student_user, Student.user_id == student_user.id)
            .join(Department, Student.department_id == Department.id)
            .join(Course, Student.course_id == Course.id)
            .outerjoin(counts, counts_alias.student_id == Student.id)
        )

        conditions = []
        if search:
            term = f"%{search}%"
            conditions.append(or_(student_user.full_name.ilike(term), Student.student_number.ilike(term)))
        if student_id is not None:
            conditions.append(Student.id == student_id)
        if department_id is not None:
            conditions.append(Student.department_id == department_id)
        if course_id is not None:
            conditions.append(Student.course_id == course_id)
        if semester is not None:
            conditions.append(Student.semester == semester)
        if section is not None:
            conditions.append(Student.section == section)
        if batch is not None:
            conditions.append(Student.batch == batch)

        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = self._order_stmt(
            stmt,
            sort,
            {
                "student_name": student_user.full_name,
                "student_number": Student.student_number,
                "total_sessions": func.coalesce(counts_alias.total_sessions, 0),
                "present": func.coalesce(counts_alias.present, 0),
                "absent": func.coalesce(counts_alias.absent, 0),
                "late": func.coalesce(counts_alias.late, 0),
                "attendance_percentage": attendance_percentage,
            },
            student_user.full_name,
        )
        return self._page(stmt, page, size)

    def _entity_stmt(
        self,
        kind: str,
        *,
        search: str | None = None,
        sort: str | None = None,
        department_id: int | None = None,
        course_id: int | None = None,
        subject_id: int | None = None,
        faculty_id: int | None = None,
        semester: int | None = None,
        section: str | None = None,
        batch: str | None = None,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ):
        faculty_user = aliased(User)
        columns = {
            "faculty": (
                Faculty.id.label("entity_id"),
                faculty_user.full_name.label("entity_name"),
                Faculty.employee_id.label("code"),
            ),
            "department": (
                Department.id.label("entity_id"),
                Department.name.label("entity_name"),
                Department.code.label("code"),
            ),
            "course": (
                Course.id.label("entity_id"),
                Course.name.label("entity_name"),
                Course.code.label("code"),
            ),
            "subject": (
                Subject.id.label("entity_id"),
                Subject.name.label("entity_name"),
                Subject.code.label("code"),
            ),
        }
        if kind not in columns:
            raise HTTPException(status_code=400, detail="Invalid report type")

        stmt = (
            select(
                *columns[kind],
                func.count(AttendanceRecord.id).label("total_records"),
                func.sum(case((AttendanceRecord.status == AttendanceStatus.PRESENT, 1), else_=0)).label("present"),
                func.sum(case((AttendanceRecord.status == AttendanceStatus.ABSENT, 1), else_=0)).label("absent"),
                func.sum(case((AttendanceRecord.status == AttendanceStatus.LATE, 1), else_=0)).label("late"),
                func.sum(case((AttendanceRecord.status == AttendanceStatus.EXCUSED, 1), else_=0)).label("excused"),
            )
            .select_from(AttendanceRecord)
            .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
            .join(SubjectAssignment, AttendanceSession.subject_assignment_id == SubjectAssignment.id)
            .join(Subject, SubjectAssignment.subject_id == Subject.id)
            .join(Course, Subject.course_id == Course.id)
            .join(Department, Subject.department_id == Department.id)
            .join(Faculty, SubjectAssignment.faculty_id == Faculty.id)
            .join(faculty_user, Faculty.user_id == faculty_user.id)
        )

        if kind == "faculty":
            group_by = [Faculty.id, faculty_user.full_name, Faculty.employee_id]
        elif kind == "department":
            group_by = [Department.id, Department.name, Department.code]
        elif kind == "course":
            group_by = [Course.id, Course.name, Course.code]
        else:
            group_by = [Subject.id, Subject.name, Subject.code]

        conditions = []
        if search:
            term = f"%{search}%"
            if kind == "faculty":
                conditions.append(or_(faculty_user.full_name.ilike(term), Faculty.employee_id.ilike(term)))
            elif kind == "department":
                conditions.append(or_(Department.name.ilike(term), Department.code.ilike(term)))
            elif kind == "course":
                conditions.append(or_(Course.name.ilike(term), Course.code.ilike(term)))
            else:
                conditions.append(or_(Subject.name.ilike(term), Subject.code.ilike(term)))
        if department_id is not None:
            conditions.append(Department.id == department_id)
        if course_id is not None:
            conditions.append(Course.id == course_id)
        if subject_id is not None:
            conditions.append(Subject.id == subject_id)
        if faculty_id is not None:
            conditions.append(Faculty.id == faculty_id)
        if semester is not None:
            conditions.append(Subject.semester == semester)
        if section is not None:
            conditions.append(SubjectAssignment.section == section)
        if batch is not None:
            conditions.append(Student.batch == batch)
        if status is not None:
            conditions.append(AttendanceRecord.status == self._parse_status(status))
        if start_date is not None:
            conditions.append(AttendanceSession.session_date >= start_date)
        if end_date is not None:
            conditions.append(AttendanceSession.session_date <= end_date)

        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.group_by(*group_by)
        total_expr = func.coalesce(func.count(AttendanceRecord.id), 0)
        percentage_expr = func.coalesce(
            (func.coalesce(func.sum(case((AttendanceRecord.status == AttendanceStatus.PRESENT, 1), else_=0)), 0) +
             func.coalesce(func.sum(case((AttendanceRecord.status == AttendanceStatus.LATE, 1), else_=0)), 0)) * 100.0 / func.nullif(total_expr, 0),
            0.0,
        ).label("attendance_percentage")
        stmt = stmt.add_columns(percentage_expr)

        sort_map = {
            "entity_name": stmt.selected_columns.entity_name,
            "code": stmt.selected_columns.code,
            "total_records": stmt.selected_columns.total_records,
            "present": stmt.selected_columns.present,
            "absent": stmt.selected_columns.absent,
            "late": stmt.selected_columns.late,
            "attendance_percentage": stmt.selected_columns.attendance_percentage,
        }
        stmt = self._order_stmt(stmt, sort, sort_map, stmt.selected_columns.entity_name)
        return stmt

    def entity_report(
        self,
        kind: str,
        *,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        sort: str | None = None,
        department_id: int | None = None,
        course_id: int | None = None,
        subject_id: int | None = None,
        faculty_id: int | None = None,
        semester: int | None = None,
        section: str | None = None,
        batch: str | None = None,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> tuple[list[dict], int]:
        stmt = self._entity_stmt(
            kind,
            search=search,
            sort=sort,
            department_id=department_id,
            course_id=course_id,
            subject_id=subject_id,
            faculty_id=faculty_id,
            semester=semester,
            section=section,
            batch=batch,
            status=status,
            start_date=start_date,
            end_date=end_date,
        )
        return self._page(stmt, page, size)

    def student_report(self, student_id: int) -> dict:
        student = self._student_or_404(student_id)
        rows, _ = self.student_summaries(page=1, size=1, student_id=student.id)
        if not rows:
            return {
                "scope": "student",
                "student_id": student.id,
                "student_number": student.student_number,
                "full_name": student.user.full_name,
                "department_id": student.department_id,
                "course_id": student.course_id,
                "sessions_attended": 0,
                "total_records": 0,
                "present": 0,
                "absent": 0,
                "late": 0,
                "excused": 0,
                "attendance_percentage": 0.0,
            }
        row = rows[0]
        return {
            "scope": "student",
            **row,
            "student_id": student.id,
            "student_number": student.student_number,
            "full_name": student.user.full_name,
        }

    def faculty_report(self, faculty_id: int) -> dict:
        faculty = self._faculty_or_404(faculty_id)
        rows, _ = self.entity_report("faculty", page=1, size=1, faculty_id=faculty_id)
        row = rows[0] if rows else {}
        return {
            "scope": "faculty",
            "faculty_id": faculty.id,
            "employee_id": faculty.employee_id,
            "full_name": faculty.user.full_name,
            **row,
        }

    def department_report(self, department_id: int) -> dict:
        department = self._department_or_404(department_id)
        rows, _ = self.entity_report("department", page=1, size=1, department_id=department_id)
        row = rows[0] if rows else {}
        return {
            "scope": "department",
            "department_id": department.id,
            "department_code": department.code,
            "department_name": department.name,
            **row,
        }

    def course_report(self, course_id: int) -> dict:
        course = self._course_or_404(course_id)
        rows, _ = self.entity_report("course", page=1, size=1, course_id=course_id)
        row = rows[0] if rows else {}
        return {
            "scope": "course",
            "course_id": course.id,
            "course_code": course.code,
            "course_name": course.name,
            **row,
        }

    def subject_report(self, subject_id: int) -> dict:
        subject = self._subject_or_404(subject_id)
        rows, _ = self.entity_report("subject", page=1, size=1, subject_id=subject_id)
        row = rows[0] if rows else {}
        return {
            "scope": "subject",
            "subject_id": subject.id,
            "subject_code": subject.code,
            "subject_name": subject.name,
            **row,
        }

    def _status_summary(self, records: list[AttendanceRecord], scope: str, **extra) -> dict:
        counts = _status_counts(records)
        total = len(records)
        return {
            "scope": scope,
            "total_records": total,
            "present": counts["present"],
            "absent": counts["absent"],
            "late": counts["late"],
            "excused": counts["excused"],
            "attendance_percentage": _percentage(counts["present"], counts["late"], total),
            **extra,
        }

    def session_summary(self, session_id: int) -> dict:
        session = self._session_or_404(session_id)
        records = list(session.attendance_records)
        return self._status_summary(
            records,
            "session",
            session_id=session.id,
            session_date=session.session_date.isoformat(),
            subject_assignment_id=session.subject_assignment_id,
            classroom_id=session.classroom_id,
            status=session.status.value,
        )

    def daily_report(self, report_date: date | None = None) -> dict:
        report_date = report_date or date.today()
        sessions = self.db.scalars(
            select(AttendanceSession).where(AttendanceSession.session_date == report_date)
        ).all()
        records, _ = self.attendance_records(start_date=report_date, end_date=report_date)
        return self._status_summary_rows(records, "daily", report_date=report_date.isoformat(), sessions=len(sessions))

    def weekly_report(self, report_date: date | None = None) -> dict:
        end_date = report_date or date.today()
        start_date = end_date - timedelta(days=6)
        records, _ = self.attendance_records(start_date=start_date, end_date=end_date)
        days = []
        for offset in range(7):
            current = start_date + timedelta(days=offset)
            day_records, _ = self.attendance_records(start_date=current, end_date=current)
            days.append({"date": current.isoformat(), **self._status_summary_rows(day_records, "day")})
        return {
            "scope": "weekly",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "days": days,
            **self._status_summary_rows(records, "weekly"),
        }

    def monthly_report(self, report_date: date | None = None) -> dict:
        target = report_date or date.today()
        start_date = target.replace(day=1)
        if start_date.month == 12:
            end_date = start_date.replace(year=start_date.year + 1, month=1) - timedelta(days=1)
        else:
            end_date = start_date.replace(month=start_date.month + 1) - timedelta(days=1)
        records, _ = self.attendance_records(start_date=start_date, end_date=end_date)
        days = []
        current = start_date
        while current <= end_date:
            day_records, _ = self.attendance_records(start_date=current, end_date=current)
            days.append({"date": current.isoformat(), **self._status_summary_rows(day_records, "day")})
            current += timedelta(days=1)
        return {
            "scope": "monthly",
            "month": start_date.strftime("%Y-%m"),
            "days": days,
            **self._status_summary_rows(records, "monthly"),
        }

    def semester_report(
        self,
        semester: int,
        *,
        course_id: int | None = None,
        department_id: int | None = None,
        section: str | None = None,
        batch: str | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 20,
        sort: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> tuple[list[dict], int]:
        return self.student_summaries(
            page=page,
            size=size,
            search=search,
            sort=sort,
            department_id=department_id,
            course_id=course_id,
            semester=semester,
            section=section,
            batch=batch,
            start_date=start_date,
            end_date=end_date,
        )

    def low_attendance_report(self, filters: AttendanceReportFilters) -> tuple[list[dict], int]:
        rows, total = self.student_summaries(
            page=filters.page,
            size=filters.size,
            search=filters.search,
            sort=filters.sort,
            department_id=filters.department_id,
            course_id=filters.course_id,
            semester=filters.semester,
            section=filters.section,
            batch=filters.batch,
            status=filters.status,
            start_date=filters.start_date,
            end_date=filters.end_date,
        )
        rows = [row for row in rows if float(row["attendance_percentage"]) <= filters.threshold]
        return rows, len(rows)

    def top_attendance_report(self, filters: AttendanceReportFilters) -> tuple[list[dict], int]:
        rows, total = self.student_summaries(
            page=filters.page,
            size=filters.size,
            search=filters.search,
            sort=filters.sort or "attendance_percentage:desc",
            department_id=filters.department_id,
            course_id=filters.course_id,
            semester=filters.semester,
            section=filters.section,
            batch=filters.batch,
            status=filters.status,
            start_date=filters.start_date,
            end_date=filters.end_date,
        )
        return rows, total

    def missing_attendance_report(self, filters: AttendanceReportFilters) -> tuple[list[dict], int]:
        rows, total = self.student_summaries(
            page=filters.page,
            size=filters.size,
            search=filters.search,
            sort=filters.sort,
            department_id=filters.department_id,
            course_id=filters.course_id,
            semester=filters.semester,
            section=filters.section,
            batch=filters.batch,
            status=filters.status,
            start_date=filters.start_date,
            end_date=filters.end_date,
        )
        rows = [row for row in rows if int(row["total_sessions"]) == 0]
        return rows, len(rows)

    def dataframe_from_records(self, **filters) -> pd.DataFrame:
        rows, _ = self.attendance_records(page=1, size=100000, **filters)
        return pd.DataFrame(rows)

    def dataframe_from_students(self, **filters) -> pd.DataFrame:
        rows, _ = self.student_summaries(page=1, size=100000, **filters)
        return pd.DataFrame(rows)

    def dataframe_from_entities(self, kind: str, **filters) -> pd.DataFrame:
        rows, _ = self.entity_report(kind, page=1, size=100000, **filters)
        return pd.DataFrame(rows)

    def export_csv(self, kind: str = "records", **filters) -> str:
        df = self._export_dataframe(kind, **filters)
        return dataframe_to_csv_bytes(df).decode("utf-8")

    def export_xlsx(self, kind: str = "records", **filters) -> bytes:
        df = self._export_dataframe(kind, **filters)
        return dataframe_to_excel_bytes(df, kind)

    def _export_dataframe(self, kind: str, **filters) -> pd.DataFrame:
        if kind == "records":
            return self.dataframe_from_records(**filters)
        if kind == "students":
            return self.dataframe_from_students(**filters)
        if kind in {"faculty", "department", "course", "subject"}:
            return self.dataframe_from_entities(kind, **filters)
        if kind == "low":
            rows, _ = self.low_attendance_report(AttendanceReportFilters(**filters))
            return pd.DataFrame(rows)
        if kind == "top":
            rows, _ = self.top_attendance_report(AttendanceReportFilters(**filters))
            return pd.DataFrame(rows)
        if kind == "missing":
            rows, _ = self.missing_attendance_report(AttendanceReportFilters(**filters))
            return pd.DataFrame(rows)
        raise HTTPException(status_code=400, detail="Invalid report export kind")

    def export_pdf(
        self,
        title: str,
        *,
        kind: str = "records",
        **filters,
    ) -> bytes:
        df = self._export_dataframe(kind, **filters)
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=letter)
        pdf.setTitle(title)
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(40, 750, title)
        pdf.setFont("Helvetica", 9)
        y = 720
        for _, row in df.head(40).iterrows():
            pdf.drawString(40, y, " | ".join(f"{key}: {row.get(key, '')}" for key in df.columns[:6]))
            y -= 18
            if y < 60:
                pdf.showPage()
                y = 740
        pdf.save()
        return buffer.getvalue()
