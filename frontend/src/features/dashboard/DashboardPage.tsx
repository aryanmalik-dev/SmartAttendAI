import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarCheck,
  Clock3,
  GraduationCap,
  Landmark,
  Percent,
  School2,
  Users
} from "lucide-react";
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
  YAxis
} from "recharts";
import { Card } from "../../components/ui/Card";
import { dashboard } from "../../lib/api";

const palette = ["#2563eb", "#0f766e", "#64748b", "#1d4ed8", "#3b82f6", "#60a5fa"];

function metricCard(label: string, value: string | number, icon: typeof GraduationCap, accent = "text-brand-700") {
  const Icon = icon;
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-md bg-slate-50 ${accent}`}>
          <Icon size={20} />
        </span>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: dashboard });

  if (isLoading || !data) {
    return <div className="text-sm font-medium text-slate-500">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Overview</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Attendance, recognition, and academic coverage at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Live attendance</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Reports</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Notifications</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCard("Total Students", data.total_students, GraduationCap)}
        {metricCard("Total Faculty", data.total_faculty ?? 0, Users)}
        {metricCard("Subjects", data.total_subjects ?? 0, School2)}
        {metricCard("Today's Sessions", data.today_sessions ?? 0, CalendarCheck)}
        {metricCard("Today's Attendance", data.today_attendance, Activity)}
        {metricCard("Present", data.present, Landmark)}
        {metricCard("Absent", data.absent, Clock3)}
        {metricCard("Attendance %", `${Number(data.attendance_percentage).toFixed(1)}%`, Percent)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Weekly Attendance</h3>
              <p className="mt-1 text-sm text-slate-500">Present and absent trend across the week.</p>
            </div>
          </div>
          <div className="mt-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weekly_trend}>
                <defs>
                  <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="present" stroke="#2563eb" fill="url(#weeklyFill)" strokeWidth={2} />
                <Line type="monotone" dataKey="absent" stroke="#64748b" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-950">Department Mix</h3>
          <p className="mt-1 text-sm text-slate-500">Students distributed across departments.</p>
          <div className="mt-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.department_wise} dataKey="students" nameKey="department" innerRadius={56} outerRadius={95} paddingAngle={2}>
                  {data.department_wise.map((entry, index) => (
                    <Cell key={`${entry.department}-${index}`} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h3 className="text-base font-semibold text-slate-950">Course Attendance</h3>
          <p className="mt-1 text-sm text-slate-500">Average attendance by course.</p>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.course_wise}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="course" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="attendance" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-950">Monthly Trend</h3>
          <p className="mt-1 text-sm text-slate-500">Longer view of recognition and marking volume.</p>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="present" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="absent" stroke="#64748b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="text-base font-semibold text-slate-950">Recent Attendance</h3>
          <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Marked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.recent_attendance ?? []).slice(0, 6).map((item) => (
                  <tr key={`${item.student_name}-${item.marked_at}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.student_name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.course_name ?? item.subject_name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.status}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(item.marked_at).toLocaleString()}</td>
                  </tr>
                ))}
                {(data.recent_attendance ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-slate-500">No recent attendance entries.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-950">Upcoming Sessions</h3>
          <div className="mt-4 space-y-3">
            {(data.upcoming_sessions ?? []).slice(0, 5).map((session) => (
              <div key={session.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{session.subject_name ?? `Session ${session.id}`}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {session.session_date} · {session.start_time} · {session.classroom_name ?? "Classroom"}
                </p>
              </div>
            ))}
            {(data.upcoming_sessions ?? []).length === 0 && <p className="text-sm text-slate-500">No upcoming sessions.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="text-base font-semibold text-slate-950">Active Sessions</h3>
          <div className="mt-4 space-y-3">
            {(data.active_sessions ?? []).slice(0, 5).map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{session.subject_name ?? `Session ${session.id}`}</p>
                  <p className="text-xs text-slate-500">{session.session_date} · {session.start_time}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Active</span>
              </div>
            ))}
            {(data.active_sessions ?? []).length === 0 && <p className="text-sm text-slate-500">No active sessions right now.</p>}
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-950">Recent Notifications</h3>
          <div className="mt-4 space-y-3">
            {(data.recent_notifications ?? []).slice(0, 5).map((item) => (
              <div key={`${item.subject}-${item.created_at}`} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{item.subject}</p>
                <p className="mt-1 text-xs text-slate-500">{item.recipient_email ?? "System"} · {item.status}</p>
              </div>
            ))}
            {(data.recent_notifications ?? []).length === 0 && <p className="text-sm text-slate-500">No recent notifications.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
