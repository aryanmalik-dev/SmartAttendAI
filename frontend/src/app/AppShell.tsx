import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, Building2, CalendarCheck, GraduationCap, LayoutDashboard, LogOut, Monitor, Settings, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "faculty", "student"] },
  { to: "/admin", label: "Admin", icon: Settings, roles: ["admin"] },
  { to: "/faculty", label: "Faculty", icon: Users, roles: ["admin", "faculty"] },
  { to: "/students", label: "Students", icon: GraduationCap, roles: ["admin", "faculty", "student"] },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ["admin", "faculty"] },
  { to: "/monitoring", label: "Monitoring", icon: Monitor, roles: ["admin", "faculty"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "faculty"] },
  { to: "/courses", label: "Courses", icon: BookOpen, roles: ["admin", "faculty", "student"] },
  { to: "/classrooms", label: "Classrooms", icon: Building2, roles: ["admin", "faculty"] }
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <Link to="/" className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 font-bold text-white">SA</span>
          <div>
            <p className="text-base font-bold text-slate-950">SmartAttend AI</p>
            <p className="text-xs text-slate-500">University attendance ops</p>
          </div>
        </Link>
        <nav className="space-y-1 px-4 py-5">
          {nav.filter((item) => user && item.roles.includes(user.role)).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon size={18} /> {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-sm text-slate-500">Logged in as</p>
            <h1 className="text-base font-semibold text-slate-950">{user?.full_name}</h1>
          </div>
          <Button onClick={() => { signOut(); navigate("/login"); }} className="bg-white text-slate-700 shadow-none ring-1 ring-slate-200 hover:bg-slate-100">
            <LogOut size={16} /> Logout
          </Button>
        </header>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
