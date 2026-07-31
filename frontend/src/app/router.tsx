import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useAuth } from "../lib/auth";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { AdminPage } from "../features/admin/AdminPage";
import { ResourcePage } from "../features/admin/ResourcePage";
import { AttendancePage } from "../features/attendance/AttendancePage";
import { FacultyPage } from "../features/faculty/FacultyPage";
import { MonitoringPage } from "../features/monitoring/MonitoringPage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { SearchPage } from "../features/search/SearchPage";
import { StudentPage } from "../features/student/StudentPage";

import { SessionManagementPage } from "../features/attendance/SessionManagementPage";

function Protected() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="grid min-h-screen place-items-center text-sm font-medium text-slate-500">Loading SmartAttend AI...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <Protected />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "admin/departments", element: <ResourcePage title="Departments" path="/departments" fields={["name", "abbreviation", "course_id", "description", "low_attendance_threshold"]} fieldTypes={{ description: "text", low_attendance_threshold: "number" }} relations={[{ field: "course_id", labelText: "Course", path: "/courses", label: (item) => `${String(item.abbreviation ?? "")} - ${String(item.name ?? "")}`.trim() }]} /> },
      { path: "faculty", element: <FacultyPage /> },
      { path: "students", element: <StudentPage /> },
      { path: "attendance", element: <AttendancePage /> },
      { path: "attendance/sessions", element: <SessionManagementPage /> },
      { path: "monitoring", element: <MonitoringPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "courses", element: <ResourcePage title="Courses" path="/courses" fields={["name", "abbreviation", "duration_years", "is_active"]} fieldTypes={{ duration_years: "number", is_active: "boolean" }} /> },
      { path: "subjects", element: <ResourcePage title="Subjects" path="/subjects" fields={["code", "name", "course_id", "department_id", "semester", "credits", "is_active"]} fieldTypes={{ semester: "number", credits: "number", is_active: "boolean" }} relations={[{ field: "course_id", labelText: "Course", path: "/courses", label: (item) => `${String(item.abbreviation ?? "")} - ${String(item.name ?? "")}`.trim() }, { field: "department_id", labelText: "Department", path: "/departments", label: (item) => `${String(item.abbreviation ?? "")} - ${String(item.name ?? "")}`.trim() }]} /> },
      { path: "subject-assignments", element: <ResourcePage title="Subject Assignments" path="/subject-assignments" fields={["faculty_id", "subject_id", "section", "academic_year", "is_active"]} fieldTypes={{ is_active: "boolean" }} relations={[{ field: "faculty_id", labelText: "Faculty", path: "/faculty", label: (item) => `${String(item.employee_id ?? "")} - ${String(item.user?.full_name ?? "")}`.trim() }, { field: "subject_id", labelText: "Subject", path: "/subjects", label: (item) => `${String(item.code ?? "")} - ${String(item.name ?? "")}`.trim() }]} /> },
      { path: "classrooms", element: <ResourcePage title="Classrooms" path="/classrooms" fields={["name", "building", "capacity", "camera_url"]} fieldTypes={{ capacity: "number" }} /> }
    ]
  }
]);
