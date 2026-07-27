from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.models.entities import AttendanceRecord, AttendanceSession, Course, Department, Faculty, Notification, Student, Subject, SubjectAssignment, User
from app.models.enums import AttendanceStatus, NotificationStatus, SessionStatus
from app.services.reports import ReportService


def _count_rows(db: Session, model) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def _attendance_counts_for_day(db: Session, target: date) -> dict[str, int]:
    session_ids = db.scalars(select(AttendanceSession.id).where(AttendanceSession.session_date == target)).all()
    if not session_ids:
        return {"present": 0, "absent": 0, "late": 0, "excused": 0, "total": 0}
    rows = db.execute(
        select(AttendanceRecord.status, func.count())
        .where(AttendanceRecord.session_id.in_(session_ids))
        .group_by(AttendanceRecord.status)
    ).all()
    counts = {"present": 0, "absent": 0, "late": 0, "excused": 0}
    for status, total in rows:
        counts[status.value] = int(total)
    counts["total"] = sum(counts.values())
    return counts


def _trend(db: Session, days: int) -> list[dict]:
    today = date.today()
    values: list[dict] = []
    for offset in range(days - 1, -1, -1):
        current = today - timedelta(days=offset)
        counts = _attendance_counts_for_day(db, current)
        percentage = round(((counts["present"] + counts["late"]) / counts["total"]) * 100, 2) if counts["total"] else 0.0
        values.append(
            {
                "date": current.isoformat(),
                "present": counts["present"],
                "absent": counts["absent"],
                "late": counts["late"],
                "excused": counts["excused"],
                "attendance_percentage": percentage,
            }
        )
    return values


def _record_rows(db: Session, limit: int = 10) -> list[dict]:
    student_user = aliased(User)
    faculty_user = aliased(User)
    rows = db.execute(
        select(
            AttendanceRecord.id.label("record_id"),
            AttendanceRecord.status.label("status"),
            AttendanceRecord.confidence.label("confidence"),
            AttendanceRecord.marked_at.label("marked_at"),
            AttendanceSession.session_date.label("session_date"),
            Student.student_number.label("student_number"),
            student_user.full_name.label("student_name"),
            Subject.code.label("subject_code"),
            Subject.name.label("subject_name"),
            Course.code.label("course_code"),
            Course.name.label("course_name"),
            Faculty.id.label("faculty_id"),
            faculty_user.full_name.label("faculty_name"),
        )
        .select_from(AttendanceRecord)
        .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
        .join(SubjectAssignment, AttendanceSession.subject_assignment_id == SubjectAssignment.id)
        .join(Subject, SubjectAssignment.subject_id == Subject.id)
        .join(Course, Subject.course_id == Course.id)
        .join(Faculty, SubjectAssignment.faculty_id == Faculty.id)
        .join(faculty_user, Faculty.user_id == faculty_user.id)
        .join(Student, AttendanceRecord.student_id == Student.id)
        .join(student_user, Student.user_id == student_user.id)
        .order_by(AttendanceRecord.marked_at.desc())
        .limit(limit)
    ).mappings().all()
    return [dict(row) for row in rows]


def _upcoming_sessions(db: Session, limit: int = 10) -> list[dict]:
    faculty_user = aliased(User)
    rows = db.execute(
        select(
            AttendanceSession.id.label("session_id"),
            AttendanceSession.session_date,
            AttendanceSession.start_time,
            AttendanceSession.end_time,
            AttendanceSession.status,
            Subject.code.label("subject_code"),
            Subject.name.label("subject_name"),
            Course.code.label("course_code"),
            Course.name.label("course_name"),
            Faculty.id.label("faculty_id"),
            faculty_user.full_name.label("faculty_name"),
        )
        .select_from(AttendanceSession)
        .join(SubjectAssignment, AttendanceSession.subject_assignment_id == SubjectAssignment.id)
        .join(Subject, SubjectAssignment.subject_id == Subject.id)
        .join(Course, Subject.course_id == Course.id)
        .join(Faculty, SubjectAssignment.faculty_id == Faculty.id)
        .join(faculty_user, Faculty.user_id == faculty_user.id)
        .where(
            AttendanceSession.session_date >= date.today(),
            AttendanceSession.status == SessionStatus.SCHEDULED,
        )
        .order_by(AttendanceSession.session_date.asc(), AttendanceSession.start_time.asc())
        .limit(limit)
    ).mappings().all()
    return [dict(row) for row in rows]


def _active_sessions(db: Session, limit: int = 10) -> list[dict]:
    faculty_user = aliased(User)
    rows = db.execute(
        select(
            AttendanceSession.id.label("session_id"),
            AttendanceSession.session_date,
            AttendanceSession.start_time,
            AttendanceSession.end_time,
            AttendanceSession.status,
            Subject.code.label("subject_code"),
            Subject.name.label("subject_name"),
            Course.code.label("course_code"),
            Course.name.label("course_name"),
            Faculty.id.label("faculty_id"),
            faculty_user.full_name.label("faculty_name"),
        )
        .select_from(AttendanceSession)
        .join(SubjectAssignment, AttendanceSession.subject_assignment_id == SubjectAssignment.id)
        .join(Subject, SubjectAssignment.subject_id == Subject.id)
        .join(Course, Subject.course_id == Course.id)
        .join(Faculty, SubjectAssignment.faculty_id == Faculty.id)
        .join(faculty_user, Faculty.user_id == faculty_user.id)
        .where(AttendanceSession.status == SessionStatus.ACTIVE)
        .order_by(AttendanceSession.session_date.desc(), AttendanceSession.start_time.desc())
        .limit(limit)
    ).mappings().all()
    return [dict(row) for row in rows]


def dashboard_metrics(db: Session) -> dict:
    today = date.today()
    report_service = ReportService(db)

    total_students = _count_rows(db, Student)
    total_faculty = _count_rows(db, Faculty)
    total_subjects = _count_rows(db, Subject)
    today_sessions = db.scalars(select(AttendanceSession).where(AttendanceSession.session_date == today)).all()
    today_session_ids = [session.id for session in today_sessions]
    today_counts = _attendance_counts_for_day(db, today)
    today_attendance = today_counts["total"]
    attendance_percentage = round(((today_counts["present"] + today_counts["late"]) / today_attendance) * 100, 2) if today_attendance else 0.0

    weekly_trend = _trend(db, 7)
    monthly_trend = _trend(db, 30)

    course_wise = report_service.entity_report("course", page=1, size=8, sort="attendance_percentage:desc")[0]
    department_wise = report_service.entity_report("department", page=1, size=8, sort="attendance_percentage:desc")[0]
    top_subjects = report_service.entity_report("subject", page=1, size=8, sort="attendance_percentage:desc")[0]
    low_attendance_students = report_service.student_summaries(page=1, size=8, sort="attendance_percentage:asc")[0]

    recent_notifications = db.execute(
        select(Notification).order_by(Notification.created_at.desc()).limit(10)
    ).scalars().all()
    recent_notifications_data = [
        {
            "id": notification.id,
            "user_id": notification.user_id,
            "channel": notification.channel,
            "subject": notification.subject,
            "message": notification.message,
            "status": notification.status.value,
            "sent_at": notification.sent_at.isoformat() if notification.sent_at else None,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
        }
        for notification in recent_notifications
    ]

    return {
        "total_students": total_students,
        "total_faculty": total_faculty,
        "total_subjects": total_subjects,
        "today_sessions": len(today_sessions),
        "today_attendance": today_attendance,
        "present": today_counts["present"],
        "absent": today_counts["absent"],
        "late": today_counts["late"],
        "excused": today_counts["excused"],
        "attendance_percentage": attendance_percentage,
        "weekly_trend": weekly_trend,
        "monthly_trend": monthly_trend,
        "course_wise": course_wise,
        "department_wise": department_wise,
        "top_subjects": top_subjects,
        "low_attendance_students": low_attendance_students,
        "recent_attendance": _record_rows(db, 10),
        "recent_notifications": recent_notifications_data,
        "upcoming_sessions": _upcoming_sessions(db, 10),
        "active_sessions": _active_sessions(db, 10),
    }
