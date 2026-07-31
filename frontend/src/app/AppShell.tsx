import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  GraduationCap,
  Layers,
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
  section: "Overview" | "Attendance Operations" | "Academic Management" | "Administration";
};

const nav: NavItem[] = [
  // Overview
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "faculty", "student"], section: "Overview" },
  { to: "/search", label: "Search", icon: Search, roles: ["admin", "faculty", "student"], section: "Overview" },

  // Attendance Operations
  { to: "/attendance", label: "Mark Attendance", icon: CalendarCheck, roles: ["admin", "faculty"], section: "Attendance Operations" },
  { to: "/attendance/sessions", label: "Sessions Hub", icon: Layers, roles: ["admin", "faculty"], section: "Attendance Operations" },
  { to: "/monitoring", label: "Vision Stream", icon: Monitor, roles: ["admin", "faculty"], section: "Attendance Operations" },
  { to: "/reports", label: "Reports & Logs", icon: BookOpen, roles: ["admin", "faculty"], section: "Attendance Operations" },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ["admin", "faculty"], section: "Attendance Operations" },

  // Academic Management
  { to: "/students", label: "Manage Students", icon: GraduationCap, roles: ["admin", "faculty", "student"], section: "Academic Management" },
  { to: "/faculty", label: "Faculty Directory", icon: Users, roles: ["admin"], section: "Academic Management" },
  { to: "/admin/departments", label: "Departments", icon: Shapes, roles: ["admin"], section: "Academic Management" },
  { to: "/courses", label: "Courses & Degrees", icon: BookOpen, roles: ["admin"], section: "Academic Management" },
  { to: "/subjects", label: "Subjects Catalog", icon: Shapes, roles: ["admin", "faculty"], section: "Academic Management" },
  { to: "/subject-assignments", label: "Faculty Assignments", icon: Users, roles: ["admin"], section: "Academic Management" },
  { to: "/classrooms", label: "Classrooms & Cameras", icon: Building2, roles: ["admin", "faculty"], section: "Academic Management" }
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

  const visibleNavSections = useMemo(() => {
    if (!user) return [];
    const filteredItems = nav
      .filter((item) => item.roles.some((role) => user.roles.includes(role)))
      .map((item) => {
        if (item.to === "/students") {
          let label = "Students";
          if (user.roles.includes("admin")) label = "Manage Students";
          else if (user.roles.includes("faculty")) label = "My Classes";
          return { ...item, label };
        }
        return item;
      });

    // Group items by section
    const sectionsMap = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      if (!sectionsMap.has(item.section)) {
        sectionsMap.set(item.section, []);
      }
      sectionsMap.get(item.section)!.push(item);
    }

    return Array.from(sectionsMap.entries()).map(([sectionTitle, items]) => ({
      title: sectionTitle,
      items
    }));
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

  const renderNavList = () => (
    <div className="space-y-6">
      {visibleNavSections.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            {section.title}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/" || item.to === "/attendance"}
                onClick={() => handleNavigate(item.to)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition ${
                    isActive ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <Link to="/" onClick={handleLogoClick} className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-xs font-bold text-white shadow-sm">SA</span>
          <div>
            <p className="text-sm font-semibold text-slate-950">SmartAttend AI</p>
            <p className="text-[11px] text-slate-500">University Operations Portal</p>
          </div>
        </Link>

        <div className="border-b border-slate-200 px-6 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Signed in as</p>
          <p className="mt-0.5 truncate text-xs sm:text-sm font-semibold text-slate-900">{user?.full_name}</p>
          <p className="text-[11px] text-slate-500">{roleLabel(user?.roles ?? [])}</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          {renderNavList()}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border border-red-200/80 px-4 py-2.5 text-xs sm:text-sm font-semibold transition shadow-sm"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[88vw] bg-white shadow-2xl flex flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">SmartAttend AI</p>
                <p className="text-[11px] text-slate-500">University Operations Portal</p>
              </div>
              <Button type="button" className="h-9 w-9 bg-white p-0 text-slate-600 shadow-none hover:bg-slate-100" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X size={18} />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4">
              {renderNavList()}
            </nav>
            <div className="border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border border-red-200/80 px-4 py-2.5 text-sm font-semibold transition shadow-sm"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
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
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user?.full_name}</p>
                <p className="text-xs text-slate-500">{roleLabel(user?.roles ?? [])}</p>
              </div>
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
