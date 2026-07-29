import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, CirclePlay, CircleStop, Info, Plus, RefreshCw, Save, Search, ShieldCheck, Upload, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import {
  api,
  getAttendanceRecords,
  getAttendanceSessions,
  getLiveAttendanceState,
  getLiveAttendanceStats,
  listResource,
  startLiveAttendance,
  stopLiveAttendance,
  submitLiveAttendanceFrame
} from "../../lib/api";
import type { LiveFaceMatch } from "../../lib/types";
import { registerWebcamStop } from "../../lib/webcam";

type ClassroomOption = { id: number; name: string; building: string };
type SubjectAssignmentOption = {
  id: number;
  section: string;
  academic_year: string;
  faculty?: { user?: { full_name: string } };
  subject?: { code?: string; name?: string };
};

const sessionSchema = z.object({
  subject_assignment_id: z.coerce.number().int().positive(),
  classroom_id: z.coerce.number().int().positive(),
  session_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().optional().or(z.literal("")),
  status: z.enum(["scheduled", "active", "completed", "cancelled"]),
  notes: z.string().optional().or(z.literal(""))
});

const correctionSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  status: z.enum(["present", "absent", "late", "excused"]),
  remarks: z.string().optional().or(z.literal(""))
});

type SessionFormValues = z.infer<typeof sessionSchema>;
type CorrectionFormValues = z.infer<typeof correctionSchema>;

type SessionRow = {
  id: number;
  subject_assignment_id: number;
  classroom_id: number;
  session_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  notes: string | null;
};

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Failed to read frame"));
    reader.readAsDataURL(blob);
  });
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [frameBusy, setFrameBusy] = useState(false);
  const [lastMatches, setLastMatches] = useState<LiveFaceMatch[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["attendance-sessions", search],
    queryFn: () => getAttendanceSessions({ search, p: 1, size: 20 })
  });
  const classroomsQuery = useQuery({
    queryKey: ["attendance-classrooms"],
    queryFn: () => listResource<ClassroomOption>("/classrooms", { p: 1, size: 100 })
  });
  const assignmentsQuery = useQuery({
    queryKey: ["attendance-assignments"],
    queryFn: () => listResource<SubjectAssignmentOption>("/subject-assignments", { p: 1, size: 100 })
  });

  const selectedSession = useMemo(
    () => sessionsQuery.data?.items.find((item) => item.id === selectedSessionId) ?? null,
    [selectedSessionId, sessionsQuery.data?.items]
  );

  const stateQuery = useQuery({
    queryKey: ["live-attendance-state", selectedSessionId],
    queryFn: () => getLiveAttendanceState(selectedSessionId!),
    enabled: Boolean(selectedSessionId),
    refetchInterval: 4000
  });
  const statsQuery = useQuery({
    queryKey: ["live-attendance-stats", selectedSessionId],
    queryFn: () => getLiveAttendanceStats(selectedSessionId!),
    enabled: Boolean(selectedSessionId),
    refetchInterval: 4000
  });
  const recordsQuery = useQuery({
    queryKey: ["attendance-records", selectedSessionId],
    queryFn: () => getAttendanceRecords({ session_id: selectedSessionId, p: 1, size: 25 }),
    enabled: Boolean(selectedSessionId),
    refetchInterval: 6000
  });

  const sessionForm = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      status: "scheduled"
    }
  });
  const correctionForm = useForm<CorrectionFormValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      status: "present"
    }
  });

  const createSession = useMutation({
    mutationFn: async (payload: SessionFormValues) => {
      const { data } = await api.post("/attendance/sessions", {
        ...payload,
        end_time: payload.end_time || null,
        notes: payload.notes || null
      });
      return data.data as SessionRow;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      setSelectedSessionId(session.id);
      setToast("Attendance session created");
      setOpenCreate(false);
      sessionForm.reset({ status: "scheduled" });
    }
  });

  const markManual = useMutation({
    mutationFn: async (payload: CorrectionFormValues) => {
      if (!selectedSessionId) throw new Error("Select a session");
      const { data } = await api.post(`/attendance/sessions/${selectedSessionId}/manual`, {
        ...payload,
        remarks: payload.remarks || null
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-records", selectedSessionId] });
      queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] });
      setToast("Attendance corrected");
      correctionForm.reset({ status: "present" });
    }
  });

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraActive(true);
      setStreamReady(true);
    } catch {
      setToast("Camera access was blocked or unavailable");
    }
  }

  function stopCamera() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setStreamReady(false);
  }

  async function captureFrame() {
    if (!selectedSessionId || !cameraActive || frameBusy) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return;

    setFrameBusy(true);
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (!blob) return;
      const imageBase64 = await toBase64(blob);
      const res = await submitLiveAttendanceFrame(selectedSessionId, imageBase64);
      if (res?.matches) setLastMatches(res.matches);
      queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] });
      queryClient.invalidateQueries({ queryKey: ["attendance-records", selectedSessionId] });
    } catch {
      setToast("Frame processing failed");
    } finally {
      setFrameBusy(false);
    }
  }

  async function handleUploadPhoto(file: File) {
    if (!selectedSessionId || frameBusy) return;
    setFrameBusy(true);
    try {
      const imageBase64 = await toBase64(file);
      const res = await submitLiveAttendanceFrame(selectedSessionId, imageBase64);
      if (res?.matches) setLastMatches(res.matches);
      await queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-records", selectedSessionId] });
      setToast("Classroom photo processed successfully");
    } catch {
      setToast("Classroom photo processing failed");
    } finally {
      setFrameBusy(false);
    }
  }

  async function startLive() {
    if (!selectedSessionId) return;
    await startLiveAttendance(selectedSessionId);
    queryClient.invalidateQueries({ queryKey: ["live-attendance-state", selectedSessionId] });
    queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] });
    setToast("Live attendance started");
    if (!cameraActive) await startCamera();
  }

  async function stopLive() {
    if (!selectedSessionId) return;
    await stopLiveAttendance(selectedSessionId);
    queryClient.invalidateQueries({ queryKey: ["live-attendance-state", selectedSessionId] });
    queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] });
    setToast("Live attendance stopped");
    stopCamera();
  }

  const [autoScanEnabled, setAutoScanEnabled] = useState(false);

  useEffect(() => {
    if (cameraActive && selectedSessionId && autoScanEnabled) {
      intervalRef.current = window.setInterval(() => {
        void captureFrame();
      }, 2500);
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cameraActive, selectedSessionId, autoScanEnabled]);

  useEffect(() => {
    const unregister = registerWebcamStop(stopCamera);
    return () => {
      unregister();
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!selectedSessionId && sessionsQuery.data?.items.length) {
      setSelectedSessionId(sessionsQuery.data.items[0].id);
    }
  }, [selectedSessionId, sessionsQuery.data?.items]);

  const stats = statsQuery.data;
  const state = stateQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Attendance</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Live Attendance</h2>
          <p className="mt-1 text-sm text-slate-500">Create sessions, run webcam recognition, and correct records in real time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setOpenCreate(true)}>
            <Plus size={16} />
            Create Session
          </Button>
          <Button type="button" onClick={() => void captureFrame()} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" disabled={!cameraActive || !selectedSessionId}>
            <Save size={16} />
            Capture Frame
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr_0.95fr]">
        <Card className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3">
            <Search size={18} className="text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sessions"
              className="border-0 px-0 focus:ring-0"
            />
          </div>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionsQuery.data?.items.map((session) => (
                  <tr
                    key={session.id}
                    className={`cursor-pointer hover:bg-slate-50 ${selectedSessionId === session.id ? "bg-brand-50/60" : ""}`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">#{session.id}</td>
                    <td className="px-4 py-3 text-slate-600">{session.session_date}</td>
                    <td className="px-4 py-3 text-slate-600">{session.status}</td>
                  </tr>
                ))}
                {(sessionsQuery.data?.items.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-slate-500">No sessions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Selected Session</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedSession ? `Session ${selectedSession.id}` : "Choose a session to begin"}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${state?.can_process ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {state?.can_process ? "Ready" : "Idle"}
              </span>
            </div>

            {selectedSession && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Date</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedSession.session_date}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedSession.status}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Live State</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{state?.session.status ?? "unknown"}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Session</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">#{selectedSession.id}</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void startCamera()} disabled={cameraActive}>
                <Camera size={16} />
                {cameraActive ? "Camera Active" : "Start Webcam"}
              </Button>
              <Button type="button" onClick={stopCamera} disabled={!cameraActive} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                <CameraOff size={16} />
                Stop Webcam
              </Button>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950">Recognition & Photo Processing</h3>
              <span className="text-xs font-semibold text-slate-500">
                {frameBusy ? "Processing frame..." : streamReady ? (autoScanEnabled ? "Auto-Scanning Active" : "Webcam Ready (Manual Snap)") : "Camera Idle"}
              </span>
            </div>

            {/* Video Feed Preview */}
            <video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-lg bg-slate-900 object-cover shadow-inner" />
            <canvas ref={canvasRef} className="hidden" />

            {/* Ingestion & Snap Control Actions */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void captureFrame()}
                    disabled={!cameraActive || !selectedSessionId || frameBusy}
                    className="bg-brand-600 text-white hover:bg-brand-700 font-semibold"
                  >
                    <Camera size={16} />
                    Snap & Process Photo
                  </Button>

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
                    <Upload size={16} />
                    Upload Classroom Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        await handleUploadPhoto(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <Button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] })} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                  <RefreshCw size={16} />
                  Refresh Stats
                </Button>
              </div>

              {/* Auto-Scan Stream Toggle Switch */}
              <div className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2.5 border border-slate-200">
                <input
                  type="checkbox"
                  id="autoScanToggle"
                  checked={autoScanEnabled}
                  onChange={(e) => setAutoScanEnabled(e.target.checked)}
                  disabled={!cameraActive || !selectedSessionId}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="autoScanToggle" className="cursor-pointer text-xs font-semibold text-slate-700 select-none">
                  Enable Continuous Auto-Scan Stream (Captures frame every 2.5s automatically)
                </label>
              </div>
            </div>
            <p className="text-xs text-slate-500">Note: Manual photo snap is recommended for full control. Continuous auto-scan can be toggled on/off as needed.</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <h3 className="text-base font-semibold text-slate-950">Live Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Detected", stats?.total_faces ?? 0],
                ["Recognized", stats?.recognized_faces ?? 0],
                ["Unknown", stats?.unknown_faces ?? 0],
                ["Duplicates", stats?.duplicate_faces ?? 0],
                ["Marked", stats?.marked_records ?? 0],
                ["Attendance %", `${Number(stats?.attendance_percentage ?? 0).toFixed(1)}%`]
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Session Status</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{stats?.session_status ?? "idle"}</p>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950">Manual Correction</h3>
              <ShieldCheck size={18} className="text-brand-600" />
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={correctionForm.handleSubmit((values) => {
                markManual.mutate(values);
              })}
            >
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Student ID</span>
                <Input {...correctionForm.register("student_id")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Status</span>
                <select {...correctionForm.register("status")} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Remarks</span>
                <Input {...correctionForm.register("remarks")} />
              </label>
              <Button type="submit" disabled={markManual.isPending || !selectedSessionId}>
                {markManual.isPending ? "Saving..." : "Save Correction"}
              </Button>
            </form>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950">Recent Activity & Detections</h3>
              {lastMatches.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  Last Photo: {lastMatches.length} Face{lastMatches.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Display Latest Photo/Frame Face Matches (including Unknown Faces) */}
            {lastMatches.length > 0 && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Latest Photo Recognition Feedback</p>
                <div className="space-y-2">
                  {lastMatches.map((match, idx) => {
                    if (match.status === "unknown") {
                      return (
                        <div key={`match-${idx}`} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide text-amber-800">
                              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                              Unknown Face Detected
                            </span>
                            <span className="rounded bg-amber-200/80 px-2 py-0.5 text-xs font-bold text-amber-900">
                              Similarity: {(match.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            Unrecognized face in classroom frame (Below 58% similarity threshold). No student matched.
                          </p>
                        </div>
                      );
                    }
                    if (match.status === "duplicate") {
                      return (
                        <div key={`match-${idx}`} className="rounded-md border border-blue-200 bg-blue-50 p-2.5 text-blue-900">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-blue-800">
                              <Info size={14} className="text-blue-600 shrink-0" />
                              {match.student_name ?? `Student #${match.student_id}`}
                            </span>
                            <span className="text-xs text-blue-700 font-medium">
                              Duplicate (Already Present)
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={`match-${idx}`} className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-900">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            {match.student_name ?? `Student #${match.student_id}`}
                          </span>
                          <span className="rounded bg-emerald-200/80 px-2 py-0.5 text-xs font-bold text-emerald-900">
                            Match: {(match.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-emerald-700 font-medium">Marked PRESENT via AI Face Recognition</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Saved Attendance Roster Records */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Saved Roster Records</p>
              {(recordsQuery.data?.items ?? []).slice(0, 8).map((record) => (
                <div key={record.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Student #{record.student_id}</p>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-700">{record.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Confidence: {record.confidence != null ? `${(Number(record.confidence) * 100).toFixed(1)}%` : "Manual"} · {new Date(record.marked_at).toLocaleTimeString()}
                  </p>
                </div>
              ))}
              {(recordsQuery.data?.items.length ?? 0) === 0 && lastMatches.length === 0 && (
                <p className="text-sm text-slate-500">No attendance records or face detections yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        title="Create Attendance Session"
        open={openCreate}
        onClose={() => setOpenCreate(false)}
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={sessionForm.handleSubmit((values) => {
            createSession.mutate(values);
          })}
        >
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Subject Assignment</span>
            <select {...sessionForm.register("subject_assignment_id")} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Select assignment</option>
              {assignmentsQuery.data?.items.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  #{assignment.id} {assignment.subject?.code ?? "Subject"} - {assignment.faculty?.user?.full_name ?? "Faculty"} ({assignment.section})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Classroom</span>
            <select {...sessionForm.register("classroom_id")} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Select classroom</option>
              {classroomsQuery.data?.items.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name} - {classroom.building}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Date</span>
            <Input type="date" {...sessionForm.register("session_date")} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Start Time</span>
            <Input type="time" {...sessionForm.register("start_time")} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">End Time</span>
            <Input type="time" {...sessionForm.register("end_time")} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Status</span>
            <select {...sessionForm.register("status")} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="sm:col-span-2 block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Notes</span>
            <Input {...sessionForm.register("notes")} />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <Button type="button" onClick={() => setOpenCreate(false)} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
              Cancel
            </Button>
            <Button type="submit" disabled={createSession.isPending}>
              {createSession.isPending ? "Creating..." : "Create Session"}
            </Button>
          </div>
        </form>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
