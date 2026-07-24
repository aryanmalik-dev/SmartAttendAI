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
import { ReportsPage } from "../features/reports/ReportsPage";
import { StudentPage } from "../features/student/StudentPage";

function Protected() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="grid min-h-screen place-items-center text-sm font-semibold text-slate-600">Loading SmartAttend AI...</div>;
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
      { path: "admin/departments", element: <ResourcePage title="Departments" path="/departments" fields={["code", "name", "description"]} /> },
      { path: "faculty", element: <FacultyPage /> },
      { path: "students", element: <StudentPage /> },
      { path: "attendance", element: <AttendancePage /> },
      { path: "monitoring", element: <MonitoringPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "courses", element: <ResourcePage title="Courses" path="/courses" fields={["code", "name", "semester", "credits"]} /> },
      { path: "classrooms", element: <ResourcePage title="Classrooms" path="/classrooms" fields={["name", "building", "capacity"]} /> }
    ]
  }
]);
