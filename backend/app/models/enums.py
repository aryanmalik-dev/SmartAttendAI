from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    FACULTY = "faculty"
    STUDENT = "student"


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"


class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AttendanceSource(str, Enum):
    FACE = "face"
    MANUAL = "manual"
    IMPORT = "import"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
