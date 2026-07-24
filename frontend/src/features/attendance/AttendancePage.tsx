import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, CheckCircle2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { api, listResource } from "../../lib/api";
import { registerWebcamStop } from "../../lib/webcam";

type CourseSummary = { id: number; code: string; name: string };
type FacultySummary = { id: number; employee_id: string; user?: { full_name: string } };
type ClassroomSummary = { id: number; name: string; building: string };

const sessionSchema = z.object({
  course_id: z.coerce.number().int().positive(),
  faculty_id: z.coerce.number().int().positive(),
  classroom_id: z.coerce.number().int().positive(),
  session_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().optional().or(z.literal("")),
  status: z.enum(["scheduled", "active", "completed", "cancelled"]),
  notes: z.string().optional().or(z.literal(""))
});

type SessionFormValues = z.infer<typeof sessionSchema>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendancePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => listResource<Record<string, unknown>>("/attendance/sessions") });
  const courses = useQuery({ queryKey: ["attendance-courses"], queryFn: () => listResource<CourseSummary>("/courses") });
  const faculty = useQuery({ queryKey: ["attendance-faculty"], queryFn: () => listResource<FacultySummary>("/faculty") });
  const classrooms = useQuery({ queryKey: ["attendance-classrooms"], queryFn: () => listResource<ClassroomSummary>("/classrooms") });
  const { register, handleSubmit, formState, reset, watch } = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      course_id: 0,
      faculty_id: 0,
      classroom_id: 0,
      session_date: today(),
      start_time: "09:00",
      end_time: "",
      status: "scheduled",
      notes: ""
    }
  });

  const recognize = useMutation({
    mutationFn: async (image_base64: string) => {
      if (!sessionId) throw new Error("Select an attendance session first.");
      return (await api.post(`/attendance/sessions/${sessionId}/recognize`, { image_base64 })).data.data;
    },
    onSuccess: (data) => setToast(`Marked ${data.marked.length} student(s), ${data.unknown_faces} unknown face(s)`)
  });
  const createSession = useMutation({
    mutationFn: async (values: SessionFormValues) => {
      const payload = {
        course_id: values.course_id,
        faculty_id: values.faculty_id,
        classroom_id: values.classroom_id,
        session_date: values.session_date,
        start_time: values.start_time,
        end_time: values.end_time || null,
        status: values.status,
        notes: values.notes || null
      };
      return (await api.post("/attendance/sessions", payload)).data.data as { id: number };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setSessionId(String(data.id));
      setToast(`Session #${data.id} created`);
      setCreateOpen(false);
      reset({
        course_id: 0,
        faculty_id: 0,
        classroom_id: 0,
        session_date: today(),
        start_time: "09:00",
        end_time: "",
        status: "scheduled",
        notes: ""
      });
    }
  });
  function stopCamera() {
    const video = videoRef.current;
    const stream = video?.srcObject instanceof MediaStream ? video.srcObject : null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) video.srcObject = null;
    setCameraActive(false);
  }

  async function toggleCamera() {
    if (cameraActive) {
      stopCamera();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (videoRef.current) videoRef.current.srcObject = stream;
    setCameraActive(true);
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!sessionId) {
      setToast("Select an attendance session first.");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    recognize.mutate(canvas.toDataURL("image/jpeg", 0.9));
  }

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    const unregister = registerWebcamStop(stopCamera);
    return () => unregister();
  }, []);

  useEffect(() => {
    const firstSession = sessions.data?.items?.[0];
    if (!sessionId && firstSession?.id !== undefined && firstSession?.id !== null) {
      setSessionId(String(firstSession.id));
      return;
    }
    if (sessionId && sessions.data?.items && !sessions.data.items.some((session) => String(session.id) === sessionId)) {
      if (firstSession?.id !== undefined && firstSession?.id !== null) {
        setSessionId(String(firstSession.id));
      } else {
        setSessionId("");
      }
    }
  }, [sessionId, sessions.data]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Webcam Attendance</h2>
            <p className="text-sm text-slate-500">Detect faces, match ArcFace embeddings, and prevent duplicate marks.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32"><Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} aria-label="Session ID" placeholder="Session ID" /></div>
            <Button type="button" className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" onClick={() => setCreateOpen(true)}><Plus size={16} /> Create Session</Button>
          </div>
        </div>
        <video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-lg bg-slate-900 object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={toggleCamera}>{cameraActive ? <CameraOff size={16} /> : <Camera size={16} />}{cameraActive ? " Stop Webcam" : " Start Webcam"}</Button>
          <Button onClick={capture} disabled={recognize.isPending || !cameraActive || !sessionId}><CheckCircle2 size={16} /> Mark Attendance</Button>
        </div>
      </Card>
      <Card>
        <h3 className="mb-4 text-lg font-semibold">Attendance Sessions</h3>
        <div className="space-y-3">
          {sessions.data?.items.map((session) => (
            <button
              key={String(session.id)}
              onClick={() => setSessionId(String(session.id))}
              className={`w-full rounded-md border p-3 text-left text-sm ${String(session.id) === sessionId ? "border-brand-300 bg-brand-50" : "border-slate-200 hover:border-brand-200 hover:bg-brand-50"}`}
            >
              <span className="font-semibold">Session #{String(session.id)}</span>
              <span className="ml-2 text-slate-500">{String(session.session_date)}</span>
            </button>
          ))}
          {sessions.data?.items.length === 0 && <p className="text-sm text-slate-500">No attendance sessions exist yet. Create one first, then start recognition.</p>}
        </div>
      </Card>
      <Modal title="Create Attendance Session" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => createSession.mutate(values))}
        >
          <label className="text-sm font-semibold text-slate-700">
            Course
            <select
              className="focus-ring mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              {...register("course_id")}
            >
              <option value={0}>Select course</option>
              {courses.data?.items.map((course) => (
                <option key={course.id} value={course.id}>{course.code} - {course.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Faculty
            <select
              className="focus-ring mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              {...register("faculty_id")}
            >
              <option value={0}>Select faculty</option>
              {faculty.data?.items.map((item) => (
                <option key={item.id} value={item.id}>{item.user?.full_name ?? "Faculty"} - {item.employee_id}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Classroom
            <select
              className="focus-ring mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              {...register("classroom_id")}
            >
              <option value={0}>Select classroom</option>
              {classrooms.data?.items.map((item) => (
                <option key={item.id} value={item.id}>{item.name} - {item.building}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Date
            <Input className="mt-2" type="date" {...register("session_date")} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Start Time
            <Input className="mt-2" type="time" {...register("start_time")} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            End Time
            <Input className="mt-2" type="time" {...register("end_time")} />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Status
            <select
              className="focus-ring mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              {...register("status")}
            >
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Notes
            <Input className="mt-2" placeholder="Optional session notes" {...register("notes")} />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button type="button" className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createSession.isPending}>{createSession.isPending ? "Creating..." : "Create Session"}</Button>
          </div>
          {(formState.errors.course_id || formState.errors.faculty_id || formState.errors.classroom_id) && (
            <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              Fill in course, faculty, and classroom to create the session.
            </p>
          )}
        </form>
      </Modal>
      <Toast message={toast} />
    </div>
  );
}
