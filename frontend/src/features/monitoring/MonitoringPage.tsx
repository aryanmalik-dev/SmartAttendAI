import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, Eye, UserX } from "lucide-react";
import { useState } from "react";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { api } from "../../lib/api";

type MonitoringSession = {
  session_id: number;
  subject_assignment_id: number;
  classroom_id: number;
  status: string;
  detected_students: number;
  unknown_faces: number;
  live_attendance_count: number;
  session_duration_seconds: number;
  average_confidence: number;
};

export function MonitoringPage() {
  const [sessionId, setSessionId] = useState("1");

  const query = useQuery({
    queryKey: ["monitoring", sessionId],
    queryFn: async () => (await api.get(`/monitoring/sessions/${sessionId}`)).data.data as MonitoringSession,
    refetchInterval: 5000,
    enabled: Boolean(sessionId)
  });

  const items = [
    { label: "Detected Students", value: query.data?.detected_students ?? 0, icon: Eye },
    { label: "Unknown Faces", value: query.data?.unknown_faces ?? 0, icon: UserX },
    { label: "Live Attendance", value: query.data?.live_attendance_count ?? 0, icon: Activity },
    { label: "Duration", value: `${Math.floor((query.data?.session_duration_seconds ?? 0) / 60)}m`, icon: Clock3 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Monitoring</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Live Classroom Monitoring</h2>
          <p className="mt-1 text-sm text-slate-500">A compact telemetry view for active recognition sessions.</p>
        </div>
        <div className="w-full max-w-[180px]">
          <Input value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="Session ID" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-md bg-slate-50 text-brand-700">
                  <Icon size={18} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Recognition Confidence</h3>
            <p className="mt-1 text-sm text-slate-500">Average confidence across the active session.</p>
          </div>
          <p className="text-sm font-medium text-slate-700">{(query.data?.average_confidence ?? 0).toFixed(3)}</p>
        </div>
        <div className="mt-4 h-3 rounded-full bg-slate-100">
          <div className="h-3 rounded-full bg-brand-600" style={{ width: `${Math.min(100, (query.data?.average_confidence ?? 0) * 100)}%` }} />
        </div>
        <div className="mt-4 rounded-md border border-slate-200 p-4 text-sm text-slate-600">
          Session status: <span className="font-medium text-slate-900">{query.data?.status ?? "unknown"}</span>
        </div>
      </Card>
    </div>
  );
}
