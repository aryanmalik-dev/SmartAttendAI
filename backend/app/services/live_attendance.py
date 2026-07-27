from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.entities import AttendanceRecord, AttendanceSession, FaceEmbedding, Student, SubjectAssignment, User
from app.models.enums import AttendanceSource, AttendanceStatus, SessionStatus, UserRole
from app.schemas.live_attendance import LiveAttendanceFrameIn, LiveAttendanceFrameOut, LiveAttendanceSessionStateOut, LiveAttendanceStatsOut, LiveFaceMatchOut
from app.services.face import FaceRecognitionProvider, decode_base64_image, get_face_provider


class LiveAttendanceService:
    def __init__(self, db: Session, provider: FaceRecognitionProvider | None = None):
        self.db = db
        self.provider = provider or get_face_provider()

    def _session_query(self):
        return select(AttendanceSession).options(
            selectinload(AttendanceSession.subject_assignment).selectinload(SubjectAssignment.faculty),
            selectinload(AttendanceSession.subject_assignment).selectinload(SubjectAssignment.subject),
            selectinload(AttendanceSession.classroom),
            selectinload(AttendanceSession.attendance_records),
        )

    def _get_session(self, session_id: int) -> AttendanceSession:
        item = self.db.scalar(self._session_query().where(AttendanceSession.id == session_id))
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance session not found")
        return item

    def _role_set(self, user: User) -> set[UserRole]:
        return {assignment.role for assignment in user.roles}

    def _validate_owner(self, session: AttendanceSession, user: User) -> None:
        roles = self._role_set(user)
        if UserRole.ADMIN in roles:
            return
        if UserRole.FACULTY not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        if session.subject_assignment.faculty.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this attendance session")

    def _validate_active(self, session: AttendanceSession) -> None:
        if session.status != SessionStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Attendance session is not active")

    def _validate_startable(self, session: AttendanceSession) -> None:
        if session.status == SessionStatus.COMPLETED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Completed attendance sessions cannot be restarted")
        if session.status == SessionStatus.CANCELLED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cancelled attendance sessions cannot be started")

    def _student_total(self, session: AttendanceSession) -> int:
        subject = session.subject_assignment.subject
        return self.db.scalar(
            select(func.count()).select_from(Student).where(
                Student.department_id == subject.department_id,
                Student.course_id == subject.course_id,
                Student.semester == subject.semester,
                Student.section == session.subject_assignment.section,
            )
        ) or 0

    def _session_counts(self, session_id: int) -> dict[str, int]:
        rows = self.db.execute(
            select(AttendanceRecord.status, func.count())
            .where(AttendanceRecord.session_id == session_id)
            .group_by(AttendanceRecord.status)
        ).all()
        counts = {"present": 0, "absent": 0, "late": 0, "excused": 0}
        for status_value, count in rows:
            counts[status_value.value] = int(count)
        return counts

    def _stats(
        self,
        session: AttendanceSession,
        total_faces: int,
        recognized_faces: int,
        unknown_faces: int,
        duplicate_faces: int,
    ) -> LiveAttendanceStatsOut:
        counts = self._session_counts(session.id)
        total_students = self._student_total(session)
        present_count = counts["present"]
        attendance_percentage = round((present_count / total_students) * 100, 2) if total_students else 0.0
        return LiveAttendanceStatsOut(
            session_id=session.id,
            session_status=session.status,
            total_faces=total_faces,
            recognized_faces=recognized_faces,
            unknown_faces=unknown_faces,
            duplicate_faces=duplicate_faces,
            marked_records=sum(counts.values()),
            present_count=present_count,
            absent_count=counts["absent"],
            late_count=counts["late"],
            excused_count=counts["excused"],
            total_students=total_students,
            attendance_percentage=attendance_percentage,
        )

    def start(self, session_id: int, user: User) -> AttendanceSession:
        session = self._get_session(session_id)
        self._validate_owner(session, user)
        self._validate_startable(session)
        if session.status == SessionStatus.ACTIVE:
            return session
        session.status = SessionStatus.ACTIVE
        self.db.commit()
        self.db.refresh(session)
        return session

    def stop(self, session_id: int, user: User) -> AttendanceSession:
        session = self._get_session(session_id)
        self._validate_owner(session, user)
        if session.status == SessionStatus.COMPLETED:
            return session
        if session.status != SessionStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Attendance session is not active")
        session.status = SessionStatus.COMPLETED
        session.end_time = datetime.now(timezone.utc).time()
        self.db.commit()
        self.db.refresh(session)
        return session

    def state(self, session_id: int, user: User) -> LiveAttendanceSessionStateOut:
        session = self._get_session(session_id)
        self._validate_owner(session, user)
        return LiveAttendanceSessionStateOut(
            session=session,
            can_process=session.status == SessionStatus.ACTIVE,
            can_stop=session.status == SessionStatus.ACTIVE,
        )

    def process_frame(self, session_id: int, user: User, payload: LiveAttendanceFrameIn) -> LiveAttendanceFrameOut:
        session = self._get_session(session_id)
        self._validate_owner(session, user)
        self._validate_active(session)

        image_bytes = decode_base64_image(payload.image_base64)
        faces = self.provider.extract(image_bytes)
        threshold = get_settings().face_similarity_threshold

        active_embeddings = self.db.scalars(
            select(FaceEmbedding)
            .where(FaceEmbedding.is_active.is_(True))
            .options(selectinload(FaceEmbedding.student).selectinload(Student.user))
        ).all()

        existing_records = self.db.scalars(
            select(AttendanceRecord).where(AttendanceRecord.session_id == session_id)
        ).all()
        existing_by_student = {record.student_id: record for record in existing_records}

        marked_records: list[AttendanceRecord] = []
        matches: list[LiveFaceMatchOut] = []
        seen_students: set[int] = set()
        unknown_faces = 0
        duplicate_faces = 0

        for face in faces:
            best_embedding = None
            best_score = -1.0
            for embedding in active_embeddings:
                score = self.provider.compare(face.embedding, embedding.embedding)
                if score > best_score:
                    best_score = score
                    best_embedding = embedding

            if best_embedding is None or best_score < threshold:
                unknown_faces += 1
                matches.append(
                    LiveFaceMatchOut(
                        student_id=None,
                        student_name=None,
                        confidence=max(best_score, 0.0),
                        bbox=face.bbox,
                        status="unknown",
                    )
                )
                continue

            student = best_embedding.student
            student_name = student.user.full_name if student and student.user else None

            if best_embedding.student_id in seen_students:
                duplicate_faces += 1
                matches.append(
                    LiveFaceMatchOut(
                        student_id=best_embedding.student_id,
                        student_name=student_name,
                        confidence=best_score,
                        bbox=face.bbox,
                        status="duplicate",
                    )
                )
                continue

            seen_students.add(best_embedding.student_id)
            record = existing_by_student.get(best_embedding.student_id)
            if record is None:
                record = AttendanceRecord(
                    session_id=session_id,
                    student_id=best_embedding.student_id,
                    marked_by_id=user.id,
                    status=AttendanceStatus.PRESENT,
                    confidence=best_score,
                    source=AttendanceSource.FACE,
                    marked_at=datetime.now(timezone.utc),
                )
                self.db.add(record)
                existing_by_student[best_embedding.student_id] = record
            else:
                record.status = AttendanceStatus.PRESENT
                record.marked_by_id = user.id
                record.source = AttendanceSource.FACE
                record.confidence = max(record.confidence or 0.0, best_score)
                record.marked_at = datetime.now(timezone.utc)

            marked_records.append(record)
            matches.append(
                LiveFaceMatchOut(
                    student_id=best_embedding.student_id,
                    student_name=student_name,
                    confidence=best_score,
                    bbox=face.bbox,
                    status="marked",
                )
            )

        self.db.commit()
        for record in marked_records:
            self.db.refresh(record)

        stats = self._stats(
            session=session,
            total_faces=len(faces),
            recognized_faces=len(seen_students),
            unknown_faces=unknown_faces,
            duplicate_faces=duplicate_faces,
        )
        return LiveAttendanceFrameOut(
            **stats.model_dump(),
            marked=marked_records,
            matches=matches,
        )

    def stats(self, session_id: int, user: User) -> LiveAttendanceStatsOut:
        session = self._get_session(session_id)
        self._validate_owner(session, user)
        return self._stats(session, total_faces=0, recognized_faces=0, unknown_faces=0, duplicate_faces=0)
