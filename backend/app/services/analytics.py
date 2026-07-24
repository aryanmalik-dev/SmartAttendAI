from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import AttendanceRecord, AttendanceSession, Course, Department, Student
from app.models.enums import AttendanceStatus


def dashboard_metrics(db: Session) -> dict:
    today = date.today()
    total_students = db.scalar(select(func.count()).select_from(Student)) or 0
    today_sessions = db.scalars(select(AttendanceSession).where(AttendanceSession.session_date == today)).all()
    today_session_ids = [session.id for session in today_sessions]
    present = 0
    absent = 0
    if today_session_ids:
        present = db.scalar(select(func.count()).select_from(AttendanceRecord).where(
            AttendanceRecord.session_id.in_(today_session_ids),
            AttendanceRecord.status == AttendanceStatus.PRESENT,
        )) or 0
        absent = db.scalar(select(func.count()).select_from(AttendanceRecord).where(
            AttendanceRecord.session_id.in_(today_session_ids),
            AttendanceRecord.status == AttendanceStatus.ABSENT,
        )) or 0
    weekly = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        session_ids = [s.id for s in db.scalars(select(AttendanceSession).where(AttendanceSession.session_date == day)).all()]
        count = 0
        if session_ids:
            count = db.scalar(select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.status == AttendanceStatus.PRESENT,
            )) or 0
        weekly.append({"date": day.isoformat(), "present": count})
    courses = db.scalars(select(Course).limit(8)).all()
    course_wise = [{"course": c.code, "attendance": len([r for s in db.scalars(select(AttendanceSession).where(AttendanceSession.course_id == c.id)).all() for r in s.records])} for c in courses]
    departments = db.scalars(select(Department).limit(8)).all()
    department_wise = [{"department": d.code, "students": db.scalar(select(func.count()).select_from(Student).where(Student.department_id == d.id)) or 0} for d in departments]
    percentage = round((present / max(present + absent, 1)) * 100, 2)
    return {
        "total_students": total_students,
        "today_attendance": present + absent,
        "present": present,
        "absent": absent,
        "attendance_percentage": percentage,
        "weekly_trend": weekly,
        "monthly_trend": weekly,
        "course_wise": course_wise,
        "department_wise": department_wise,
    }
