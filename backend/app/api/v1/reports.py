from __future__ import annotations

from datetime import date
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.responses import ok, page as page_response
from app.db.session import get_db
from app.models.enums import UserRole
from app.schemas.reports import AttendanceReportFilters
from app.services.data_io import dataframe_to_csv_bytes, dataframe_to_excel_bytes
from app.services.reports import ReportService

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.FACULTY))])


def _stream(data: bytes, filename: str, media_type: str) -> StreamingResponse:
    return StreamingResponse(BytesIO(data), media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _filename(kind: str, file_format: str) -> tuple[str, str]:
    if file_format == "xlsx":
        return f"{kind}.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return f"{kind}.csv", "text/csv"


def _export(service: ReportService, kind: str, file_format: str, **filters):
    if file_format == "xlsx":
        payload = service.export_xlsx(kind, **filters)
    else:
        payload = service.export_csv(kind, **filters).encode("utf-8")
    filename, media_type = _filename(kind, file_format)
    return _stream(payload, filename, media_type)


@router.get("/records")
def records(
    filters: AttendanceReportFilters = Depends(),
    student_id: int | None = None,
    db: Session = Depends(get_db),
):
    items, total = ReportService(db).attendance_records(
        page=filters.page,
        size=filters.size,
        student_id=student_id,
        search=filters.search,
        sort=filters.sort,
        department_id=filters.department_id,
        course_id=filters.course_id,
        subject_id=filters.subject_id,
        faculty_id=filters.faculty_id,
        semester=filters.semester,
        section=filters.section,
        batch=filters.batch,
        status=filters.status,
        start_date=filters.start_date,
        end_date=filters.end_date,
    )
    return page_response(items, total, filters.page, filters.size)


@router.get("/students")
def students(filters: AttendanceReportFilters = Depends(), db: Session = Depends(get_db)):
    items, total = ReportService(db).student_summaries(
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
    return page_response(items, total, filters.page, filters.size)


@router.get("/students/{student_id}")
def student_report(student_id: int, db: Session = Depends(get_db)):
    return ok(ReportService(db).student_report(student_id), "Student report")


@router.get("/students/{student_id}/records")
def student_records(
    student_id: int,
    filters: AttendanceReportFilters = Depends(),
    db: Session = Depends(get_db),
):
    items, total = ReportService(db).attendance_records(
        page=filters.page,
        size=filters.size,
        student_id=student_id,
        search=filters.search,
        sort=filters.sort,
        department_id=filters.department_id,
        course_id=filters.course_id,
        subject_id=filters.subject_id,
        faculty_id=filters.faculty_id,
        semester=filters.semester,
        section=filters.section,
        batch=filters.batch,
        status=filters.status,
        start_date=filters.start_date,
        end_date=filters.end_date,
    )
    return page_response(items, total, filters.page, filters.size)


@router.get("/faculty")
def faculty(filters: AttendanceReportFilters = Depends(), db: Session = Depends(get_db)):
    items, total = ReportService(db).entity_report(
        "faculty",
        page=filters.page,
        size=filters.size,
        search=filters.search,
        sort=filters.sort,
        department_id=filters.department_id,
        course_id=filters.course_id,
        subject_id=filters.subject_id,
        faculty_id=filters.faculty_id,
        semester=filters.semester,
        section=filters.section,
        batch=filters.batch,
        status=filters.status,
        start_date=filters.start_date,
        end_date=filters.end_date,
    )
    return page_response(items, total, filters.page, filters.size)


@router.get("/faculty/{faculty_id}")
def faculty_report(faculty_id: int, db: Session = Depends(get_db)):
    return ok(ReportService(db).faculty_report(faculty_id), "Faculty report")


@router.get("/departments")
def departments(filters: AttendanceReportFilters = Depends(), db: Session = Depends(get_db)):
    items, total = ReportService(db).entity_report(
        "department",
        page=filters.page,
        size=filters.size,
        search=filters.search,
        sort=filters.sort,
        department_id=filters.department_id,
        course_id=filters.course_id,
        subject_id=filters.subject_id,
        faculty_id=filters.faculty_id,
        semester=filters.semester,
        section=filters.section,
        batch=filters.batch,
        status=filters.status,
        start_date=filters.start_date,
        end_date=filters.end_date,
    )
    return page_response(items, total, filters.page, filters.size)


@router.get("/departments/{department_id}")
def department_report(department_id: int, db: Session = Depends(get_db)):
    return ok(ReportService(db).department_report(department_id), "Department report")


@router.get("/courses")
def courses(filters: AttendanceReportFilters = Depends(), db: Session = Depends(get_db)):
    items, total = ReportService(db).entity_report(
        "course",
        page=filters.page,
        size=filters.size,
        search=filters.search,
        sort=filters.sort,
        department_id=filters.department_id,
        course_id=filters.course_id,
        subject_id=filters.subject_id,
        faculty_id=filters.faculty_id,
        semester=filters.semester,
        section=filters.section,
        batch=filters.batch,
        status=filters.status,
        start_date=filters.start_date,
        end_date=filters.end_date,
    )
    return page_response(items, total, filters.page, filters.size)


@router.get("/courses/{course_id}")
def course_report(course_id: int, db: Session = Depends(get_db)):
    return ok(ReportService(db).course_report(course_id), "Course report")


@router.get("/subjects")
def subjects(filters: AttendanceReportFilters = Depends(), db: Session = Depends(get_db)):
    items, total = ReportService(db).entity_report(
        "subject",
        page=filters.page,
        size=filters.size,
        search=filters.search,
        sort=filters.sort,
        department_id=filters.department_id,
        course_id=filters.course_id,
        subject_id=filters.subject_id,
        faculty_id=filters.faculty_id,
        semester=filters.semester,
        section=filters.section,
        batch=filters.batch,
        status=filters.status,
        start_date=filters.start_date,
        end_date=filters.end_date,
    )
    return page_response(items, total, filters.page, filters.size)


@router.get("/subjects/{subject_id}")
def subject_report(subject_id: int, db: Session = Depends(get_db)):
    return ok(ReportService(db).subject_report(subject_id), "Subject report")


@router.get("/daily")
def daily(
    db: Session = Depends(get_db),
    session_id: int | None = None,
    report_date: date | None = None,
):
    service = ReportService(db)
    data = service.session_summary(session_id) if session_id is not None else service.daily_report(report_date)
    return ok(data, "Daily report")


@router.get("/weekly")
def weekly(
    db: Session = Depends(get_db),
    session_id: int | None = None,
    report_date: date | None = None,
):
    service = ReportService(db)
    data = service.session_summary(session_id) if session_id is not None else service.weekly_report(report_date)
    return ok(data, "Weekly report")


@router.get("/monthly")
def monthly(
    db: Session = Depends(get_db),
    session_id: int | None = None,
    report_date: date | None = None,
):
    service = ReportService(db)
    data = service.session_summary(session_id) if session_id is not None else service.monthly_report(report_date)
    return ok(data, "Monthly report")


@router.get("/semester")
def semester(
    db: Session = Depends(get_db),
    semester_no: int = Query(..., ge=1),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    sort: str | None = None,
    department_id: int | None = None,
    course_id: int | None = None,
    section: str | None = None,
    batch: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    items, total = ReportService(db).semester_report(
        semester=semester_no,
        page=page,
        size=size,
        search=search,
        sort=sort,
        department_id=department_id,
        course_id=course_id,
        section=section,
        batch=batch,
        start_date=start_date,
        end_date=end_date,
    )
    return page_response(items, total, page, size)


@router.get("/low-attendance")
def low_attendance(filters: AttendanceReportFilters = Depends(), db: Session = Depends(get_db)):
    items, total = ReportService(db).low_attendance_report(filters)
    return page_response(items, total, filters.page, filters.size)


@router.get("/top-attendance")
def top_attendance(filters: AttendanceReportFilters = Depends(), db: Session = Depends(get_db)):
    items, total = ReportService(db).top_attendance_report(filters)
    return page_response(items, total, filters.page, filters.size)


@router.get("/missing-attendance")
def missing_attendance(filters: AttendanceReportFilters = Depends(), db: Session = Depends(get_db)):
    items, total = ReportService(db).missing_attendance_report(filters)
    return page_response(items, total, filters.page, filters.size)


@router.get("/export/{kind}")
def export_report(
    kind: str,
    file_format: str = Query("csv", pattern="^(csv|xlsx)$"),
    filters: AttendanceReportFilters = Depends(),
    db: Session = Depends(get_db),
):
    service = ReportService(db)
    payload = service.export_xlsx(kind, **filters.model_dump(exclude={"page", "size", "threshold"})) if file_format == "xlsx" else service.export_csv(kind, **filters.model_dump(exclude={"page", "size", "threshold"})).encode("utf-8")
    filename = f"{kind}.{file_format}"
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if file_format == "xlsx" else "text/csv"
    return _stream(payload, filename, media_type)


@router.get("/export/csv")
def export_csv(
    filters: AttendanceReportFilters = Depends(),
    db: Session = Depends(get_db),
):
    service = ReportService(db)
    payload = service.export_csv("records", **filters.model_dump(exclude={"page", "size", "threshold"})).encode("utf-8")
    return _stream(payload, "attendance.csv", "text/csv")


@router.get("/export/xlsx")
def export_xlsx(
    filters: AttendanceReportFilters = Depends(),
    db: Session = Depends(get_db),
):
    service = ReportService(db)
    payload = service.export_xlsx("records", **filters.model_dump(exclude={"page", "size", "threshold"}))
    return _stream(payload, "attendance.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
