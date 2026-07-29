import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Search,
  Settings,
  Shapes,
  X,
  Users
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { stopAllWebcams } from "../lib/webcam";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/types";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
};

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "faculty", "student"] },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ["admin", "faculty"] },
  { to: "/monitoring", label: "Monitoring", icon: Monitor, roles: ["admin", "faculty"] },
  { to: "/reports", label: "Reports", icon: BookOpen, roles: ["admin", "faculty"] },
  { to: "/search", label: "Search", icon: Search, roles: ["admin", "faculty", "student"] },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ["admin", "faculty"] },
  { to: "/students", label: "Students", icon: GraduationCap, roles: ["admin", "faculty", "student"] },
  { to: "/faculty", label: "Faculty", icon: Users, roles: ["admin", "faculty"] },
  { to: "/admin/departments", label: "Departments", icon: Shapes, roles: ["admin", "faculty"] },
  { to: "/courses", label: "Courses", icon: BookOpen, roles: ["admin", "faculty", "student"] },
  { to: "/subjects", label: "Subjects", icon: Shapes, roles: ["admin", "faculty", "student"] },
  { to: "/subject-assignments", label: "Assignments", icon: Users, roles: ["admin", "faculty"] },
  { to: "/classrooms", label: "Classrooms", icon: Building2, roles: ["admin", "faculty"] },
  { to: "/admin", label: "Admin", icon: Settings, roles: ["admin"] }
];

function roleLabel(roles: Role[]) {
  if (roles.includes("admin")) return "Administrator";
  if (roles.includes("faculty")) return "Faculty";
  return "Student";
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = useMemo(() => {
    if (!user) return [];
    return nav
      .filter((item) => item.roles.some((role) => user.roles.includes(role)))
      .map((item) => {
        if (item.to === "/students") {
          let label = "Students";
          if (user.roles.includes("admin")) label = "Manage Students";
          else if (user.roles.includes("faculty")) label = "Classes";
          return { ...item, label };
        }
        return item;
      });
  }, [user]);

  useEffect(() => {
    stopAllWebcams();
    setMobileOpen(false);
  }, [location.pathname]);

  function handleNavigate(to: string) {
    stopAllWebcams();
    setMobileOpen(false);
    navigate(to);
  }

  function handleLogoClick() {
    stopAllWebcams();
    setMobileOpen(false);
  }

  function handleLogout() {
    stopAllWebcams();
    signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <Link to="/" onClick={handleLogoClick} className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-brand-600 text-sm font-semibold text-white">SA</span>
          <div>
            <p className="text-base font-semibold text-slate-950">SmartAttend AI</p>
            <p className="text-xs text-slate-500">University operations console</p>
          </div>
        </Link>

        <div className="border-b border-slate-200 px-6 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Signed in as</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{user?.full_name}</p>
          <p className="text-xs text-slate-500">{roleLabel(user?.roles ?? [])}</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => handleNavigate(item.to)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <Button type="button" onClick={handleLogout} className="w-full justify-center bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[88vw] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">SmartAttend AI</p>
                <p className="text-xs text-slate-500">University operations console</p>
              </div>
              <Button type="button" className="h-9 w-9 bg-white p-0 text-slate-600 shadow-none hover:bg-slate-100" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X size={18} />
              </Button>
            </div>
            <nav className="space-y-1 p-4">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => handleNavigate(item.to)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                        isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`
                    }
                  >
                    <Icon size={17} />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button type="button" className="h-10 w-10 shrink-0 bg-white p-0 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <Menu size={18} />
              </Button>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-slate-400">SmartAttend AI</p>
                <h1 className="truncate text-sm font-semibold text-slate-950">Campus attendance and classroom monitoring</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">{user?.full_name}</p>
                <p className="text-xs text-slate-500">{roleLabel(user?.roles ?? [])}</p>
              </div>
              <Button type="button" onClick={handleLogout} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 lg:px-8 lg:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
