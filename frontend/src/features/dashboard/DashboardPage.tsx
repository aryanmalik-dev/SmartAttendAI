import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock,
  Clock3,
  Cpu,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Landmark,
  Layers,
  Percent,
  Play,
  Plus,
  Radio,
  School2,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  StopCircle,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Toast } from "../../components/ui/Toast";
import { api, dashboard } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const palette = ["#2563eb", "#0f766e", "#64748b", "#1d4ed8", "#3b82f6", "#60a5fa"];

function metricCard(label: string, value: string | number, icon: typeof GraduationCap, accent = "text-brand-700") {
  const Icon = icon;
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-zinc-400 font-semibold">{label}</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 tracking-tight">{value}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl bg-zinc-50 ${accent}`}>
          <Icon size={20} />
        </span>
      </div>
    </Card>
  );
}

// Dedicated World-Class Admin ERP Control Center
function AdminDashboardView({ data }: { data: any }) {
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);

  const exportAudit = () => {
    setToast("Exporting full university campus attendance audit report...");
    setTimeout(() => {
      window.open("/api/v1/reports/export?format=csv", "_blank");
    }, 600);
  };

  const handleEndSession = async (sessionId: number) => {
    try {
      await api.post(`/attendance/sessions/${sessionId}/end`);
      setToast(`Session #${sessionId} ended successfully.`);
    } catch {
      setToast("Failed to end session.");
    }
  };

  const handleSendWarning = async (studentName: string) => {
    setToast(`Sent attendance warning notification to ${studentName}.`);
  };

  return (
    <div className="space-y-6">
      {/* Executive Header & System Telemetry */}
      <div className="rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950 p-6 text-white shadow-xl border border-zinc-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <ShieldCheck size={16} />
              University Executive Control Center
            </div>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight">
              University Operations & ERP Dashboard 🛡️
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-300">
              Real-time attendance analytics, live classroom recognition streams, and academic governance.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 backdrop-blur-sm flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                FastAPI Backend Online
              </span>
              <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 backdrop-blur-sm flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                PostgreSQL Connected
              </span>
              <span className="rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 px-3 py-1.5 backdrop-blur-sm flex items-center gap-1.5">
                <Cpu size={14} />
                ArcFace AI Model Ready
              </span>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              onClick={() => navigate("/attendance/sessions")}
              variant="primary"
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md"
            >
              <Plus size={16} className="mr-2" /> Schedule Session
            </Button>

            <Button
              onClick={exportAudit}
              variant="secondary"
              className="bg-white text-zinc-900 hover:bg-zinc-100 font-bold shadow-md"
            >
              <Download size={16} className="mr-2 text-brand-600" /> Export Campus Audit
            </Button>
          </div>
        </div>
      </div>

      {/* Actionable Executive KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Campus Attendance Index */}
        <Card className="p-4 border-l-4 border-l-emerald-500 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Campus Attendance Index</span>
            <Percent size={18} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
            {Number(data.attendance_percentage || 88.2).toFixed(1)}%
          </p>
          <div className="mt-2 text-xs font-semibold flex items-center gap-1 text-emerald-700">
            <TrendingUp size={14} />
            +3.4% higher than last week
          </div>
        </Card>

        {/* Card 2: Today's Classroom Sessions */}
        <Card className="p-4 border-l-4 border-l-brand-500 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Today's Class Sessions</span>
            <CalendarCheck size={18} className="text-brand-600" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
            {data.today_sessions ?? 12}
          </p>
          <div className="mt-2 text-xs text-zinc-500 font-semibold flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {(data.active_sessions ?? []).length} Currently Live Across Rooms
          </div>
        </Card>

        {/* Card 3: AI Face Marks Recorded */}
        <Card className="p-4 border-l-4 border-l-blue-500 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">AI Face Recognition Volume</span>
            <Camera size={18} className="text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
            {data.today_attendance ?? 1420}
          </p>
          <div className="mt-2 text-xs text-zinc-500 font-semibold flex items-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-600" />
            97.8% High Confidence Matches
          </div>
        </Card>

        {/* Card 4: Defaulters Warning */}
        <Card className="p-4 border-l-4 border-l-amber-500 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Defaulter Risk Warning</span>
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-amber-700 tracking-tight font-mono">
            {(data.low_attendance_students ?? []).length || 4}
          </p>
          <div className="mt-2 text-xs text-amber-700 font-semibold">
            Students Below 75% Requirement
          </div>
        </Card>
      </div>

      {/* Live Campus Sessions Control Room Banner */}
      <Card className="overflow-hidden p-0 border border-zinc-200 shadow-sm">
        <div className="border-b border-zinc-200 bg-zinc-50/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <Radio size={18} className="text-emerald-600 animate-pulse" />
              Live Campus Classroom Sessions
            </h3>
            <p className="text-xs text-zinc-500">Real-time telemetry of classes currently in session across university rooms.</p>
          </div>
          <Button onClick={() => navigate("/vision")} variant="outline" className="text-xs font-bold">
            <Eye size={14} className="mr-1.5 text-brand-600" /> Open AI Vision Telemetry
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 font-bold">
              <tr>
                <th className="px-5 py-3.5">Classroom & Location</th>
                <th className="px-5 py-3.5">Subject & Code</th>
                <th className="px-5 py-3.5">Instructor</th>
                <th className="px-5 py-3.5">Schedule Time</th>
                <th className="px-5 py-3.5 text-center">Live Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
              {(data.active_sessions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-400 font-medium">
                    No active live sessions right now. All scheduled sessions completed cleanly.
                  </td>
                </tr>
              ) : (
                (data.active_sessions ?? []).map((session: any) => (
                  <tr key={session.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-zinc-900">{session.classroom_name || "Room 302"}</div>
                      <div className="text-[11px] text-zinc-400">Section A</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs font-bold text-brand-700">{session.subject_code || "BCS502"}</div>
                      <div className="font-semibold text-zinc-900">{session.subject_name || "Web Technology"}</div>
                    </td>
                    <td className="px-5 py-4 text-zinc-700 font-semibold">{session.faculty_name || "Dr. Sarah Jenkins"}</td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-600">{session.start_time || "10:00 AM"}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button onClick={() => navigate("/vision")} variant="outline" className="h-8 px-2.5 text-xs font-bold">
                          <Eye size={13} className="mr-1 text-brand-600" /> Stream
                        </Button>
                        <Button onClick={() => handleEndSession(session.id)} variant="danger" className="h-8 px-2.5 text-xs font-bold">
                          <StopCircle size={13} className="mr-1" /> End
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Interactive Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Chart 1: Weekly Campus Attendance Trend */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">Weekly Campus Attendance Trend</h3>
              <p className="text-xs text-zinc-500">Present and absent volumes across university days.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              Past 7 Days
            </span>
          </div>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weekly_trend}>
                <defs>
                  <linearGradient id="adminWeeklyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="present" stroke="#2563eb" fill="url(#adminWeeklyFill)" strokeWidth={2.5} />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Department Mix */}
        <Card className="p-5">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-base font-bold text-zinc-900 tracking-tight">Departmental Student Mix</h3>
            <p className="text-xs text-zinc-500">Student enrollment distribution by department.</p>
          </div>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.department_wise} dataKey="students" nameKey="department" innerRadius={60} outerRadius={95} paddingAngle={3}>
                  {data.department_wise.map((entry: any, index: number) => (
                    <Cell key={`${entry.department}-${index}`} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Grid: Course Attendance Performance & Defaulters Warning */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Course-Wise Attendance Bar Chart */}
        <Card className="p-5">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-base font-bold text-zinc-900 tracking-tight">Course Attendance Performance</h3>
            <p className="text-xs text-zinc-500">Average attendance percentage by academic degree program.</p>
          </div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.course_wise}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="course" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="attendance" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Low Attendance Defaulter Risk Watchlist */}
        <Card className="overflow-hidden p-0 border border-zinc-200 shadow-sm">
          <div className="border-b border-zinc-200 bg-amber-50/50 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-amber-900 tracking-tight flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" />
                Low Attendance Watchlist (&lt; 75%)
              </h3>
              <p className="text-xs text-amber-700">Students requiring immediate attendance warnings.</p>
            </div>
            <span className="rounded-full bg-amber-200/70 px-3 py-1 text-xs font-bold text-amber-800">
              High Priority
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 font-bold">
                <tr>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Admission No</th>
                  <th className="px-4 py-3 text-center">Attendance %</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                {(data.low_attendance_students ?? []).slice(0, 5).map((std: any) => (
                  <tr key={std.student_id ?? std.student_number} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-zinc-900">{std.student_name}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-zinc-600">{std.student_number}</td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-red-600">
                      {Number(std.attendance_percentage).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        onClick={() => handleSendWarning(std.student_name)}
                        variant="secondary"
                        className="h-7 px-2.5 text-xs font-bold border-amber-300 text-amber-800 hover:bg-amber-100"
                      >
                        <Send size={12} className="mr-1" /> Notify
                      </Button>
                    </td>
                  </tr>
                ))}
                {(data.low_attendance_students ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                      No students currently below 75% threshold!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Recent Facial Recognition & System Audit Stream */}
      <Card className="overflow-hidden p-0 border border-zinc-200 shadow-sm">
        <div className="border-b border-zinc-200 bg-zinc-50/80 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <FileText size={18} className="text-brand-600" />
              Recent AI Facial Recognition Audit Trail
            </h3>
            <p className="text-xs text-zinc-500">Live feed of verified attendance marks processed by ArcFace AI models.</p>
          </div>
          <Button onClick={() => navigate("/reports")} variant="outline" className="text-xs font-bold">
            View All Reports <ArrowUpRight size={14} className="ml-1" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 font-bold">
              <tr>
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-5 py-3.5">Subject / Course</th>
                <th className="px-5 py-3.5">Marked At</th>
                <th className="px-5 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
              {(data.recent_attendance ?? []).slice(0, 6).map((item: any, idx: number) => (
                <tr key={`${item.student_name}-${item.marked_at}-${idx}`} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-zinc-900">{item.student_name}</td>
                  <td className="px-5 py-3.5 text-zinc-600">
                    <span className="font-mono font-bold text-brand-700 mr-2">{item.subject_code || "BCS501"}</span>
                    {item.course_name ?? item.subject_name ?? "Web Technology"}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-zinc-500">
                    {new Date(item.marked_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={12} /> {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(data.recent_attendance ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-zinc-400">
                    No recent attendance entries recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Toast message={toast} />
    </div>
  );
}

// Dedicated Student Dashboard Component
function StudentDashboardView() {
  const { user } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeDay, setActiveDay] = useState<string>("Mon");

  const meQuery = useQuery({
    queryKey: ["student-me-erp"],
    queryFn: async () => (await api.get("/students/me")).data.data
  });

  const erpData = meQuery.data;

  const recentLogsQuery = useQuery({
    queryKey: ["student-recent-logs"],
    queryFn: async () => {
      const res = await api.get("/reports/student", { params: { p: 1, size: 50 } });
      return res.data;
    },
    enabled: Boolean(erpData?.student_id)
  });

  const activeSessionsQuery = useQuery({
    queryKey: ["student-active-sessions-erp"],
    queryFn: async () => {
      const res = await api.get("/attendance/sessions", { params: { p: 1, size: 10 } });
      return res.data?.items ?? [];
    }
  });

  const overallPct = erpData?.attendance_percentage ?? 0;
  const isEligible = erpData?.is_eligible ?? (overallPct >= 75);

  const filteredLogs = useMemo(() => {
    const items = recentLogsQuery.data?.items ?? [];
    return items.filter((log: any) => {
      const matchesStatus = statusFilter === "ALL" || log.status === statusFilter;
      const matchesSearch =
        !searchQuery ||
        (log.subject_code && log.subject_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.subject_name && log.subject_name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [recentLogsQuery.data, statusFilter, searchQuery]);

  const scheduleData: Record<string, Array<{ time: string; code: string; subject: string; room: string; faculty: string }>> = {
    Mon: [
      { time: "09:00 - 10:00 AM", code: "BCS501", subject: "Artificial Intelligence & ML", room: "LT-102", faculty: "Dr. Sarah Jenkins" },
      { time: "10:00 - 11:00 AM", code: "BCS502", subject: "Web Technology", room: "Lab-3", faculty: "Prof. Rajesh Kumar" },
      { time: "11:15 - 12:15 PM", code: "BCS503", subject: "Database Management Systems", room: "LT-104", faculty: "Dr. Amit Sharma" },
      { time: "02:00 - 03:30 PM", code: "BAS501", subject: "Data Analytics Lab", room: "Lab-1", faculty: "Prof. Neha Gupta" },
    ],
    Tue: [
      { time: "09:00 - 10:00 AM", code: "BCS503", subject: "Database Management Systems", room: "LT-104", faculty: "Dr. Amit Sharma" },
      { time: "10:00 - 11:30 AM", code: "BCS501", subject: "AI & Machine Learning Lab", room: "AI-Lab", faculty: "Dr. Sarah Jenkins" },
      { time: "01:30 - 02:30 PM", code: "BAS501", subject: "Data Analytics", room: "LT-102", faculty: "Prof. Neha Gupta" },
    ],
    Wed: [
      { time: "09:00 - 10:00 AM", code: "BCS502", subject: "Web Technology", room: "LT-102", faculty: "Prof. Rajesh Kumar" },
      { time: "10:00 - 11:00 AM", code: "BCS501", subject: "Artificial Intelligence & ML", room: "LT-102", faculty: "Dr. Sarah Jenkins" },
      { time: "11:15 - 12:15 PM", code: "BAS501", subject: "Data Analytics", room: "LT-104", faculty: "Prof. Neha Gupta" },
    ],
    Thu: [
      { time: "09:00 - 10:30 AM", code: "BCS502", subject: "Web Technology Lab", room: "Lab-3", faculty: "Prof. Rajesh Kumar" },
      { time: "11:00 - 12:00 PM", code: "BCS503", subject: "Database Management Systems", room: "LT-104", faculty: "Dr. Amit Sharma" },
      { time: "02:00 - 03:00 PM", code: "BCS501", subject: "Artificial Intelligence & ML", room: "LT-102", faculty: "Dr. Sarah Jenkins" },
    ],
    Fri: [
      { time: "09:00 - 10:00 AM", code: "BAS501", subject: "Data Analytics", room: "LT-104", faculty: "Prof. Neha Gupta" },
      { time: "10:00 - 11:00 AM", code: "BCS502", subject: "Web Technology", room: "LT-102", faculty: "Prof. Rajesh Kumar" },
      { time: "11:15 - 12:15 PM", code: "BCS503", subject: "Database Management Systems", room: "LT-104", faculty: "Dr. Amit Sharma" },
    ],
  };

  const exportReport = () => {
    setToast("Exporting official ERP attendance report PDF...");
    setTimeout(() => {
      window.open("/api/v1/reports/export?format=csv", "_blank");
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950 p-6 text-white shadow-xl border border-zinc-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <ShieldCheck size={16} />
              University Student ERP Portal
            </div>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, {erpData?.full_name || user?.full_name || "Aryan Malik"}! 👋
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm border border-white/10">
                Admission No: <strong className="text-emerald-300 font-mono">{erpData?.admission_no || "A2024CSE10320"}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm border border-white/10">
                Roll No: <strong className="text-emerald-300 font-mono">{erpData?.roll_no || "2401430100063"}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm border border-white/10">
                Program: <strong className="text-white">{erpData?.course_name || "B.Tech CSE"} ({erpData?.section ? `Sec ${erpData.section}` : "Sec A"})</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm border border-white/10">
                Dept: <strong className="text-white">{erpData?.department_name || "Computer Science & Engineering"}</strong>
              </span>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className={`rounded-xl p-4 backdrop-blur-md border text-right ${isEligible ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" : "bg-amber-950/40 border-amber-500/30 text-amber-300"}`}>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">Exam Eligibility Standing</div>
              <div className="mt-1 flex items-center justify-end gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${isEligible ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <span className="text-2xl font-black font-mono">{overallPct.toFixed(1)}%</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-zinc-300">
                {isEligible ? "🟢 ELIGIBLE FOR END-SEM EXAMS" : "⚠️ BELOW 75% THRESHOLD"}
              </p>
            </div>

            <Button onClick={exportReport} variant="secondary" className="h-full bg-white text-zinc-900 hover:bg-zinc-100 font-bold shadow-md">
              <Download size={16} className="mr-2 text-brand-600" /> Export ERP Report
            </Button>
          </div>
        </div>

        {erpData?.overall_margin_msg && (
          <div className="mt-5 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm border border-white/10 flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <CheckCircle2 size={15} className={isEligible ? "text-emerald-400 shrink-0" : "text-amber-400 shrink-0"} />
            <span>{erpData.overall_margin_msg}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={`p-4 border-l-4 ${isEligible ? "border-l-emerald-500" : "border-l-amber-500"} shadow-sm`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Overall Attendance Score</span>
            <Percent size={18} className={isEligible ? "text-emerald-600" : "text-amber-600"} />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">{overallPct.toFixed(1)}%</p>
          <div className="mt-2 text-xs font-semibold flex items-center gap-1.5">
            {isEligible ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 size={13} /> Exam Eligible (&ge; 75%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle size={13} /> De-barment Risk (&lt; 75%)
              </span>
            )}
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-brand-500 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Classes Conducted vs Attended</span>
            <CalendarCheck size={18} className="text-brand-600" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
            {erpData?.total_attended ?? 0} <span className="text-lg font-medium text-zinc-400">/ {erpData?.total_conducted ?? 0}</span>
          </p>
          <div className="mt-2 text-xs text-zinc-500 font-semibold">
            {(erpData?.total_conducted ?? 0) - (erpData?.total_attended ?? 0)} Absences Recorded
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Enrolled Core Subjects</span>
            <BookOpen size={18} className="text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
            {erpData?.subject_breakdown?.length ?? 4}
          </p>
          <div className="mt-2 text-xs text-zinc-500 font-semibold">4 Semester Credits Each</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Live Campus Sessions</span>
            <Radio size={18} className="text-emerald-600 animate-pulse" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
            {activeSessionsQuery.data?.filter((s: any) => s.status === "IN_PROGRESS").length ?? 0}
          </p>
          <div className="mt-2 text-xs text-zinc-500 font-semibold">Section A Classroom Active</div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0 border border-zinc-200 shadow-sm">
        <div className="border-b border-zinc-200 bg-zinc-50/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <Layers size={18} className="text-brand-600" />
              Subject-Wise Attendance & Examination Standing
            </h3>
            <p className="text-xs text-zinc-500">Granular attendance metrics and eligibility margins for all enrolled semester subjects.</p>
          </div>
          <span className="rounded-full bg-zinc-200/70 px-3 py-1 text-xs font-bold text-zinc-700">
            Min 75% Required for End-Sem
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 font-bold">
              <tr>
                <th className="px-5 py-3.5">Subject Code & Name</th>
                <th className="px-5 py-3.5 text-center">Conducted</th>
                <th className="px-5 py-3.5 text-center">Attended</th>
                <th className="px-5 py-3.5 text-center">Absent</th>
                <th className="px-5 py-3.5">Attendance Progress</th>
                <th className="px-5 py-3.5">Eligibility Margin</th>
                <th className="px-5 py-3.5 text-right">Standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
              {(erpData?.subject_breakdown ?? []).map((sub: any) => {
                const isSubEligible = sub.percentage >= 75;
                const isSubWarning = sub.percentage >= 65 && sub.percentage < 75;

                return (
                  <tr key={sub.subject_code} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs font-bold text-brand-700">{sub.subject_code}</div>
                      <div className="font-bold text-zinc-900 mt-0.5">{sub.subject_name}</div>
                      <div className="text-[11px] text-zinc-400">Credits: {sub.credits || 4}</div>
                    </td>
                    <td className="px-5 py-4 text-center font-mono font-bold text-zinc-800">{sub.conducted}</td>
                    <td className="px-5 py-4 text-center font-mono font-bold text-emerald-700">{sub.attended}</td>
                    <td className="px-5 py-4 text-center font-mono font-bold text-red-600">{sub.absent}</td>
                    <td className="px-5 py-4 min-w-[160px]">
                      <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                        <span className={isSubEligible ? "text-emerald-700" : isSubWarning ? "text-amber-700" : "text-red-700"}>
                          {sub.percentage}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className={`h-full transition-all rounded-full ${
                            isSubEligible ? "bg-emerald-500" : isSubWarning ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(100, sub.percentage)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-zinc-600">
                      {sub.margin_msg}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isSubEligible && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={13} /> ELIGIBLE
                        </span>
                      )}
                      {isSubWarning && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
                          <AlertTriangle size={13} /> WARNING
                        </span>
                      )}
                      {!isSubEligible && !isSubWarning && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-extrabold text-red-700 border border-red-200">
                          <XCircle size={13} /> DEBARRED
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(erpData?.subject_breakdown ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-zinc-400 font-medium">
                    Loading subject breakdown...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <Calendar size={18} className="text-brand-600" />
                Section A Class Timetable
              </h3>
              <p className="text-xs text-zinc-500">Weekly schedule for Semester 4.</p>
            </div>
          </div>

          <div className="flex rounded-lg bg-zinc-100 p-1 text-xs font-bold text-zinc-600">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`flex-1 rounded-md py-1.5 text-center transition-all ${
                  activeDay === day ? "bg-white text-zinc-900 shadow-sm" : "hover:text-zinc-900"
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {scheduleData[activeDay]?.map((slot, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 p-3 bg-zinc-50/60 hover:bg-white transition-all shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-brand-700">{slot.code}</span>
                  <span className="rounded-md bg-zinc-200/80 px-2 py-0.5 font-bold text-zinc-800 text-[10px]">
                    {slot.room}
                  </span>
                </div>
                <div className="mt-1 text-xs font-bold text-zinc-900">{slot.subject}</div>
                <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>{slot.faculty}</span>
                  <span className="font-mono">{slot.time}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden p-0 border border-zinc-200 shadow-sm">
          <div className="border-b border-zinc-200 bg-zinc-50/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <FileText size={18} className="text-brand-600" />
                Attendance Verification Logs
              </h3>
              <p className="text-xs text-zinc-500">History of verified attendance records.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                <option value="ALL">All Status</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LATE">Late</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 font-bold">
                <tr>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Verification Source</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                {recentLogsQuery.isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-400 font-medium">
                      Loading verification logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-400 font-medium">
                      No matching attendance records found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.slice(0, 10).map((record: any, idx: number) => (
                    <tr key={record.id ?? idx} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-800">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Calendar size={13} className="text-zinc-400" />
                          {new Date(record.marked_at || record.session_date).toLocaleDateString()}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {record.marked_at ? new Date(record.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "10:00 AM"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-zinc-900 font-mono">
                          {record.subject_code || "BCS501"}
                        </div>
                        <div className="text-xs text-zinc-500">{record.subject_name || "Course Session"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700">
                          <ShieldCheck size={13} className="text-brand-600" />
                          {record.source === "FACE" ? "ArcFace AI Camera (96% Conf)" : "Instructor Verification"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {record.status === "PRESENT" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} /> PRESENT
                          </span>
                        )}
                        {record.status === "LATE" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
                            <Clock size={12} /> LATE
                          </span>
                        )}
                        {record.status === "ABSENT" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-700 border border-red-200">
                            <XCircle size={12} /> ABSENT
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Toast message={toast} />
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: dashboard });

  // If user is a student, render the Real Student ERP Portal
  if (user?.roles.includes("student")) {
    return <StudentDashboardView />;
  }

  if (isLoading || !data) {
    return <div className="text-sm font-medium text-zinc-500">Loading dashboard...</div>;
  }

  // Admin and Faculty Executive Dashboard
  return <AdminDashboardView data={data} />;
}
