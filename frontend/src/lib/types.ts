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
  role: Role;
  is_active: boolean;
};

export type DashboardMetrics = {
  total_students: number;
  today_attendance: number;
  present: number;
  absent: number;
  attendance_percentage: number;
  weekly_trend: { date: string; present: number }[];
  monthly_trend: { date: string; present: number }[];
  course_wise: { course: string; attendance: number }[];
  department_wise: { department: string; students: number }[];
};

export type Page<T> = { items: T[]; total: number; page: number; size: number };
