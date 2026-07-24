import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarCheck, GraduationCap, Percent } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../../components/ui/Card";
import { dashboard } from "../../lib/api";

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: dashboard });
  if (isLoading || !data) return <div className="text-sm font-semibold text-slate-600">Loading dashboard...</div>;
  const cards = [
    { label: "Total Students", value: data.total_students, icon: GraduationCap },
    { label: "Today's Attendance", value: data.today_attendance, icon: CalendarCheck },
    { label: "Present", value: data.present, icon: Activity },
    { label: "Attendance %", value: `${data.attendance_percentage}%`, icon: Percent }
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Live attendance intelligence across departments, courses, and classrooms.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return <Card key={card.label}><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-slate-500">{card.label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{card.value}</p></div><span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon size={22} /></span></div></Card>;
        })}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card><h3 className="mb-4 text-base font-semibold">Weekly Trend</h3><ResponsiveContainer width="100%" height={300}><LineChart data={data.weekly_trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="present" stroke="#2563eb" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></Card>
        <Card><h3 className="mb-4 text-base font-semibold">Department-wise Students</h3><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={data.department_wise} dataKey="students" nameKey="department" outerRadius={100} label>{data.department_wise.map((_, i) => <Cell key={i} fill={["#2563eb", "#14b8a6", "#f97316", "#64748b"][i % 4]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></Card>
      </div>
      <Card><h3 className="mb-4 text-base font-semibold">Course-wise Attendance</h3><ResponsiveContainer width="100%" height={300}><BarChart data={data.course_wise}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="course" /><YAxis /><Tooltip /><Bar dataKey="attendance" fill="#2563eb" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></Card>
    </div>
  );
}
