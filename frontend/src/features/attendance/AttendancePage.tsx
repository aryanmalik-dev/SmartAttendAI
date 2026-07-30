import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  CirclePlay,
  CircleStop,
  Clock,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Video
} from "lucide-react";
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
  subject_assignment_id: z.coerce.number().int().positive("Select a subject assignment"),
  classroom_id: z.coerce.number().int().positive("Select a classroom"),
  session_date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().optional().or(z.literal("")),
  status: z.enum(["scheduled", "active", "completed", "cancelled"]),
  notes: z.string().optional().or(z.literal(""))
});

const correctionSchema = z.object({
  student_id: z.coerce.number().int().positive("Enter valid Student ID"),
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
      resolve(String(reader.result ?? ""));
    };
    reader.onerror = () => reject(new Error("Failed to read frame"));
    reader.readAsDataURL(blob);
  });
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [frameBusy, setFrameBusy] = useState(false);
  const [lastMatches, setLastMatches] = useState<LiveFaceMatch[]>([]);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<"ai_feed" | "roster" | "manual">("ai_feed");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Queries
  const sessionsQuery = useQuery({
    queryKey: ["attendance-sessions"],
    queryFn: () => getAttendanceSessions({ p: 1, size: 50 })
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
    queryFn: () => getAttendanceRecords({ session_id: selectedSessionId, p: 1, size: 50 }),
    enabled: Boolean(selectedSessionId),
    refetchInterval: 5000
  });

  const sessionForm = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: { status: "scheduled" }
  });
  const correctionForm = useForm<CorrectionFormValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { status: "present" }
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
      setToast("Session created successfully");
      setOpenCreate(false);
      sessionForm.reset({ status: "scheduled" });
    }
  });

  const markManual = useMutation({
    mutationFn: async (payload: CorrectionFormValues) => {
      if (!selectedSessionId) throw new Error("Select a session first");
      const { data } = await api.post(`/attendance/sessions/${selectedSessionId}/manual`, {
        ...payload,
        remarks: payload.remarks || null
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-records", selectedSessionId] });
      queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] });
      setToast("Attendance record updated");
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
      setToast("Photo processed by ArcFace AI");
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
      setToast("Photo recognition processing failed");
    } finally {
      setFrameBusy(false);
    }
  }

  async function handleStartSession() {
    if (!selectedSessionId) return;
    await startLiveAttendance(selectedSessionId);
    queryClient.invalidateQueries({ queryKey: ["live-attendance-state", selectedSessionId] });
    queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] });
    queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
    setToast("Live session started");
    if (!cameraActive) await startCamera();
  }

  async function handleStopSession() {
    if (!selectedSessionId) return;
    await stopLiveAttendance(selectedSessionId);
    queryClient.invalidateQueries({ queryKey: ["live-attendance-state", selectedSessionId] });
    queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] });
    queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
    setToast("Session completed");
    stopCamera();
  }

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
  const sessionsList = sessionsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-400">Attendance Studio</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Mark Attendance</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Run AI face recognition, upload classroom photos, or manage roster records in real time.
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="bg-zinc-900 text-white hover:bg-black font-semibold shadow-sm">
          <Plus size={16} />
          Create New Session
        </Button>
      </div>

      {/* 2. Top Session Selector Banner */}
      <Card className="p-4 sm:p-5 border-zinc-200/90 shadow-sm bg-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Active Session Picker */}
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-[260px] max-w-full">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Select Active Session
              </label>
              <select
                value={selectedSessionId ?? ""}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2 text-sm font-semibold text-zinc-900 focus:border-zinc-900 focus:bg-white focus:ring-1 focus:ring-zinc-900 transition-all cursor-pointer"
              >
                {sessionsList.map((session) => (
                  <option key={session.id} value={session.id}>
                    Session #{session.id} — {session.session_date} ({session.status.toUpperCase()})
                  </option>
                ))}
                {sessionsList.length === 0 && <option value="">No active sessions available</option>}
              </select>
            </div>

            {selectedSession && (
              <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-4">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  selectedSession.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : selectedSession.status === "completed"
                    ? "bg-zinc-100 text-zinc-700 border border-zinc-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    selectedSession.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                  }`} />
                  {selectedSession.status.toUpperCase()}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  Room ID: #{selectedSession.classroom_id}
                </span>
              </div>
            )}
          </div>

          {/* Right: Session Actions */}
          {selectedSession && (
            <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-100">
              {selectedSession.status !== "active" ? (
                <Button
                  type="button"
                  onClick={() => void handleStartSession()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm"
                >
                  <CirclePlay size={16} />
                  Start Live Session
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void handleStopSession()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs sm:text-sm"
                >
                  <CircleStop size={16} />
                  End Session
                </Button>
              )}

              <Button
                type="button"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["live-attendance-stats", selectedSessionId] });
                  queryClient.invalidateQueries({ queryKey: ["attendance-records", selectedSessionId] });
                  setToast("Session data refreshed");
                }}
                className="bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 text-xs sm:text-sm"
              >
                <RefreshCw size={15} />
                Refresh
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 3. Main Workspace Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols): Camera Viewport & Recognition Studio */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Video size={18} className="text-zinc-600" />
                <h2 className="text-base font-semibold text-zinc-900">Webcam & Recognition Stream</h2>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                frameBusy
                  ? "bg-amber-100 text-amber-800"
                  : cameraActive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-zinc-100 text-zinc-600"
              }`}>
                {frameBusy ? "Processing Frame..." : cameraActive ? "Camera Active" : "Camera Ready"}
              </span>
            </div>

            {/* Video Viewport Container */}
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-900 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {!cameraActive && (
                <div className="text-center p-6">
                  <CameraOff size={42} className="mx-auto text-zinc-700 mb-3" />
                  <p className="text-sm font-semibold text-zinc-400">Webcam Stream Disconnected</p>
                  <p className="text-xs text-zinc-600 mt-1 max-w-xs mx-auto">
                    Turn on the webcam to run live AI recognition or upload a classroom photo directly.
                  </p>
                  <Button
                    type="button"
                    onClick={() => void startCamera()}
                    className="mt-4 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
                  >
                    <Camera size={15} />
                    Start Webcam
                  </Button>
                </div>
              )}

              {/* Status Overlay HUD */}
              {cameraActive && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-xs font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Live Feed Active
                </div>
              )}
            </div>

            {/* Control Bar Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void captureFrame()}
                  disabled={!cameraActive || !selectedSessionId || frameBusy}
                  className="bg-zinc-900 text-white hover:bg-black font-semibold shadow-sm flex-1 justify-center py-2.5 text-xs sm:text-sm"
                >
                  <Camera size={16} />
                  Snap & Process Photo
                </Button>

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-50 shadow-sm transition-all flex-1">
                  <Upload size={16} />
                  Upload Photo
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

                {cameraActive && (
                  <Button
                    type="button"
                    onClick={stopCamera}
                    className="bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200 text-xs sm:text-sm"
                  >
                    <CameraOff size={16} />
                    Turn Off
                  </Button>
                )}
              </div>

              {/* Auto-Scan Toggle Card */}
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3.5 border border-zinc-200/80">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoScanToggle"
                    checked={autoScanEnabled}
                    onChange={(e) => setAutoScanEnabled(e.target.checked)}
                    disabled={!cameraActive || !selectedSessionId}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer disabled:opacity-40"
                  />
                  <label htmlFor="autoScanToggle" className="cursor-pointer select-none">
                    <p className="text-xs font-semibold text-zinc-900">Continuous Auto-Scan Stream</p>
                    <p className="text-[11px] text-zinc-500">Captures and analyzes classroom frames automatically every 2.5 seconds</p>
                  </label>
                </div>
                <Sparkles size={18} className={autoScanEnabled ? "text-amber-500 animate-bounce" : "text-zinc-300"} />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (5 cols): Live Telemetry & Attendance Roster Feedback */}
        <div className="space-y-4 lg:col-span-5">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Card className="p-3.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Present</p>
              <p className="mt-1 text-xl font-bold text-zinc-900">{stats?.marked_records ?? 0}</p>
            </Card>
            <Card className="p-3.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Recognized</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{stats?.recognized_faces ?? 0}</p>
            </Card>
            <Card className="p-3.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Unknown</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{stats?.unknown_faces ?? 0}</p>
            </Card>
            <Card className="p-3.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Rate</p>
              <p className="mt-1 text-xl font-bold text-zinc-900">{Number(stats?.attendance_percentage ?? 0).toFixed(0)}%</p>
            </Card>
          </div>

          {/* Tabbed Roster & Recognition Feedback Box */}
          <Card className="p-0 overflow-hidden border-zinc-200">
            {/* Tab Headers */}
            <div className="flex border-b border-zinc-200 bg-zinc-50/80 p-1 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("ai_feed")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "ai_feed"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                AI Detections {lastMatches.length > 0 && `(${lastMatches.length})`}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("roster")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "roster"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Roster Records ({recordsQuery.data?.items.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("manual")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "manual"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Manual Edit
              </button>
            </div>

            {/* Tab 1: AI Recognition Feedback Feed */}
            {activeTab === "ai_feed" && (
              <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
                {lastMatches.length > 0 ? (
                  lastMatches.map((match, idx) => {
                    if (match.status === "unknown") {
                      return (
                        <div key={`match-${idx}`} className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-amber-900">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide text-amber-800">
                              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                              Unknown Face Alert
                            </span>
                            <span className="rounded bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-950">
                              {(match.confidence * 100).toFixed(1)}% match
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-amber-700">
                            Unrecognized face in classroom frame. Similarity below required 58% threshold.
                          </p>
                        </div>
                      );
                    }
                    if (match.status === "duplicate") {
                      return (
                        <div key={`match-${idx}`} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-800">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-zinc-800">
                              <Info size={14} className="text-zinc-500 shrink-0" />
                              {match.student_name ?? `Student #${match.student_id}`}
                            </span>
                            <span className="text-[11px] text-zinc-500 font-medium">Already Marked</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={`match-${idx}`} className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-950">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            {match.student_name ?? `Student #${match.student_id}`}
                          </span>
                          <span className="rounded bg-emerald-200/80 px-2 py-0.5 text-[11px] font-bold text-emerald-950">
                            {(match.confidence * 100).toFixed(1)}% match
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-emerald-700">Marked PRESENT via ArcFace AI</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-10 text-center text-xs text-zinc-400">
                    <Camera size={28} className="mx-auto text-zinc-300 mb-2" />
                    No recent photo scan feedback. Click &quot;Snap &amp; Process Photo&quot; or upload a photo to start AI recognition.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Roster Records Table */}
            {activeTab === "roster" && (
              <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
                {(recordsQuery.data?.items ?? []).map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-white transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Student #{record.student_id}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {record.confidence != null ? `AI Match: ${(Number(record.confidence) * 100).toFixed(1)}%` : "Manual Entry"} · {new Date(record.marked_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                      record.status === "present"
                        ? "bg-emerald-100 text-emerald-800"
                        : record.status === "absent"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {record.status}
                    </span>
                  </div>
                ))}

                {(recordsQuery.data?.items.length ?? 0) === 0 && (
                  <div className="py-10 text-center text-xs text-zinc-400">
                    No roster records saved for this session yet.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Manual Status Adjustment Form */}
            {activeTab === "manual" && (
              <div className="p-4">
                <form
                  className="space-y-3"
                  onSubmit={correctionForm.handleSubmit((values) => markManual.mutate(values))}
                >
                  <label className="block text-xs font-semibold text-zinc-700">
                    Student ID
                    <Input {...correctionForm.register("student_id")} placeholder="e.g. 101" className="mt-1" />
                  </label>

                  <label className="block text-xs font-semibold text-zinc-700">
                    Status
                    <select {...correctionForm.register("status")} className="w-full mt-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900">
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-zinc-700">
                    Remarks (Optional)
                    <Input {...correctionForm.register("remarks")} placeholder="e.g. Approved medical leave" className="mt-1" />
                  </label>

                  <Button
                    type="submit"
                    disabled={markManual.isPending || !selectedSessionId}
                    className="w-full bg-zinc-900 text-white hover:bg-black font-semibold text-xs py-2 mt-2"
                  >
                    {markManual.isPending ? "Saving..." : "Save Record Adjustment"}
                  </Button>
                </form>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal: Create Session */}
      <Modal
        title="Create Attendance Session"
        open={openCreate}
        onClose={() => setOpenCreate(false)}
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={sessionForm.handleSubmit((values) => createSession.mutate(values))}
        >
          <label className="block text-xs font-semibold text-zinc-700">
            Subject Assignment
            <select {...sessionForm.register("subject_assignment_id")} className="w-full mt-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900">
              <option value="">Select subject assignment</option>
              {assignmentsQuery.data?.items.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  #{assignment.id} {assignment.subject?.code ?? "Subject"} - {assignment.faculty?.user?.full_name ?? "Faculty"} ({assignment.section})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-zinc-700">
            Classroom
            <select {...sessionForm.register("classroom_id")} className="w-full mt-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900">
              <option value="">Select classroom</option>
              {classroomsQuery.data?.items.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name} - {classroom.building}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-zinc-700">
            Session Date
            <Input type="date" {...sessionForm.register("session_date")} className="mt-1.5 text-xs" />
          </label>

          <label className="block text-xs font-semibold text-zinc-700">
            Start Time
            <Input type="time" {...sessionForm.register("start_time")} className="mt-1.5 text-xs" />
          </label>

          <label className="block text-xs font-semibold text-zinc-700">
            End Time (Optional)
            <Input type="time" {...sessionForm.register("end_time")} className="mt-1.5 text-xs" />
          </label>

          <label className="block text-xs font-semibold text-zinc-700">
            Status
            <select {...sessionForm.register("status")} className="w-full mt-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900">
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <label className="sm:col-span-2 block text-xs font-semibold text-zinc-700">
            Notes / Details
            <Input {...sessionForm.register("notes")} placeholder="e.g. Midterm Lab Practical" className="mt-1.5 text-xs" />
          </label>

          <div className="sm:col-span-2 flex justify-end gap-3 pt-3">
            <Button type="button" onClick={() => setOpenCreate(false)} className="bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={createSession.isPending} className="bg-zinc-900 text-white hover:bg-black text-xs font-semibold">
              {createSession.isPending ? "Creating..." : "Create Session"}
            </Button>
          </div>
        </form>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}

