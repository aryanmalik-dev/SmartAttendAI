import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Eye, UserX } from "lucide-react";
import { useState } from "react";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { api } from "../../lib/api";

export function MonitoringPage() {
  const [sessionId, setSessionId] = useState("1");
  const { data } = useQuery({ queryKey: ["monitoring", sessionId], queryFn: async () => (await api.get(`/monitoring/sessions/${sessionId}`)).data.data, refetchInterval: 5000 });
  const items = [
    { label: "Detected Students", value: data?.detected_students ?? 0, icon: Eye },
    { label: "Unknown Faces", value: data?.unknown_faces ?? 0, icon: UserX },
    { label: "Live Attendance", value: data?.live_attendance_count ?? 0, icon: Activity },
    { label: "Duration", value: `${Math.floor((data?.session_duration_seconds ?? 0) / 60)}m`, icon: Clock }
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-2xl font-bold">Live Classroom</h2><p className="text-sm text-slate-500">Session telemetry refreshes every five seconds.</p></div><div className="w-36"><Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} /></div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => { const Icon = item.icon; return <Card key={item.label}><Icon className="text-brand-600" /><p className="mt-4 text-sm text-slate-500">{item.label}</p><p className="mt-1 text-3xl font-bold">{item.value}</p></Card>; })}</div>
      <Card><h3 className="text-lg font-semibold">Recognition Confidence</h3><div className="mt-4 h-4 rounded-full bg-slate-100"><div className="h-4 rounded-full bg-brand-600" style={{ width: `${Math.min(100, (data?.average_confidence ?? 0) * 100)}%` }} /></div><p className="mt-2 text-sm text-slate-500">Average confidence: {data?.average_confidence ?? 0}</p></Card>
    </div>
  );
}
