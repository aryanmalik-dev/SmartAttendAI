export type Role = "admin" | "faculty" | "student";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type User = {
  id: number;
  email: string;
  full_name: string;
  roles: Role[];
  is_active: boolean;
  email_verified?: boolean;
};

export type DashboardMetrics = {
  total_students: number;
  total_faculty?: number;
  total_subjects?: number;
  today_sessions?: number;
  today_attendance: number;
  present: number;
  absent: number;
  attendance_percentage: number;
  weekly_trend: { date: string; present: number; absent?: number }[];
  monthly_trend: { date: string; present: number; absent?: number }[];
  course_wise: { course: string; attendance: number; present?: number; absent?: number }[];
  department_wise: { department: string; students: number; attendance?: number }[];
  recent_attendance?: {
    student_name: string;
    course_name?: string;
    subject_name?: string;
    status: string;
    marked_at: string;
  }[];
  recent_notifications?: {
    recipient_email?: string;
    subject: string;
    status: string;
    created_at: string;
  }[];
  upcoming_sessions?: {
    id: number;
    session_date: string;
    start_time: string;
    classroom_name?: string;
    subject_name?: string;
  }[];
  active_sessions?: {
    id: number;
    session_date: string;
    start_time: string;
    classroom_name?: string;
    subject_name?: string;
  }[];
};

export type Page<T> = { items: T[]; total: number; page: number; size: number };

export type NotificationItem = {
  id: number;
  user_id: number | null;
  channel: string;
  subject: string;
  message: string;
  status: "pending" | "sent" | "failed" | string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  recipient_email?: string | null;
};

export type AttendanceSession = {
  id: number;
  subject_assignment_id: number;
  classroom_id: number;
  session_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  notes: string | null;
};

export type AttendanceRecord = {
  id: number;
  session_id: number;
  student_id: number;
  marked_by_id: number | null;
  status: string;
  confidence: number | null;
  source: string;
  marked_at: string;
  remarks: string | null;
};

export type LiveAttendanceStats = {
  session_id: number;
  session_status: string;
  total_faces: number;
  recognized_faces: number;
  unknown_faces: number;
  duplicate_faces: number;
  marked_records: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  total_students: number;
  attendance_percentage: number;
};

export type LiveFaceMatch = {
  student_id: number | null;
  student_name: string | null;
  confidence: number;
  bbox: number[];
  status: string;
};

export type LiveAttendanceFrame = LiveAttendanceStats & {
  marked: AttendanceRecord[];
  matches: LiveFaceMatch[];
};

export type LiveAttendanceState = {
  session: AttendanceSession;
  can_process: boolean;
  can_stop: boolean;
};

export type SearchResultItem = {
  entity_type: string;
  id: number;
  title: string;
  subtitle?: string;
  status?: string;
  meta?: Record<string, string | number | null | undefined>;
};

export type GlobalSearchResult = {
  query: string;
  total: number;
  items: SearchResultItem[];
};

