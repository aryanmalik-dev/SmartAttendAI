import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, RefreshCw, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { api, listResource } from "../../lib/api";
import { useAuth } from "../../lib/auth";

type StudentSummary = {
  id: number;
  student_number: string;
  department_id: number;
  enrollment_year: number;
  user?: { full_name: string; email: string };
};

type OwnStudent = {
  student_id: number;
  student_number: string;
  attendance_percentage: number;
};

type EnrollmentTarget = {
  id: number;
  label: string;
  replaceExisting?: boolean;
};

type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string; message?: string } } }).response;
    return response?.data?.detail ?? response?.data?.message ?? "Face enrollment failed";
  }
  return "Face enrollment failed";
}

function FaceEnrollmentModal({ target, onClose, onSuccess }: { target: EnrollmentTarget | null; onClose: () => void; onSuccess: (message: string) => void }) {
  const [mode, setMode] = useState<"upload" | "webcam">("upload");
  const [items, setItems] = useState<ImageItem[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const enroll = useMutation({
    mutationFn: async () => {
      if (!target) return null;
      const form = new FormData();
      items.forEach((item) => form.append("files", item.file));
      const path = replaceExisting ? `/students/${target.id}/reenroll-face` : `/students/${target.id}/faces`;
      const { data } = await api.post(path, form);
      return data.data as { embeddings_created: number };
    },
    onSuccess: (data) => {
      const count = data?.embeddings_created ?? 0;
      onSuccess(`Face enrollment complete. ${count} embedding${count === 1 ? "" : "s"} created.`);
      closeAndReset();
    },
    onError: (err) => setError(errorMessage(err))
  });

  function closeAndReset() {
    stopCamera();
    clearItems();
    setError(null);
    setReplaceExisting(false);
    setMode("upload");
    onClose();
  }

  function addFiles(files: File[]) {
    setError(null);
    setItems((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ]);
  }

  function removeItem(id: string) {
    setItems((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  }

  function clearItems() {
    setItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError("Camera access was blocked or unavailable.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) {
      setError("Start the webcam before capturing a face image.");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setError("Could not capture webcam image.");
      return;
    }
    addFiles([new File([blob], `webcam-face-${Date.now()}.jpg`, { type: "image/jpeg" })]);
  }

  function submit() {
    if (items.length === 0) {
      setError("Add at least one face image before submitting.");
      return;
    }
    enroll.mutate();
  }

  useEffect(() => {
    setReplaceExisting(Boolean(target?.replaceExisting));
    if (!target) stopCamera();
    return () => stopCamera();
  }, [target]);

  return (
    <Modal title={`Face Enrollment - ${target?.label ?? ""}`} open={Boolean(target)} onClose={closeAndReset}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1">
          <button type="button" onClick={() => setMode("upload")} className={`rounded px-3 py-2 text-sm font-semibold ${mode === "upload" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`}>Upload Images</button>
          <button type="button" onClick={() => setMode("webcam")} className={`rounded px-3 py-2 text-sm font-semibold ${mode === "webcam" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`}>Use Webcam</button>
        </div>

        {mode === "upload" ? (
          <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <Upload className="mx-auto mb-2 text-brand-600" size={28} />
            <span className="text-sm font-semibold text-slate-800">Choose clear face images</span>
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => addFiles(Array.from(event.target.files ?? []))} />
          </label>
        ) : (
          <div className="space-y-3">
            <video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-lg bg-slate-900 object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={startCamera}><Camera size={16} /> Start Webcam</Button>
              <Button type="button" onClick={captureFrame} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><Upload size={16} /> Capture Image</Button>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Re-enroll and replace previous active embeddings
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">{items.length} image{items.length === 1 ? "" : "s"} ready</p>
            {items.length > 0 && <button type="button" onClick={clearItems} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Clear</button>}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <img src={item.previewUrl} alt="" className="aspect-square w-full object-cover" />
                <button type="button" onClick={() => removeItem(item.id)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button type="button" onClick={closeAndReset} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">Cancel</Button>
          <Button type="button" onClick={submit} disabled={enroll.isPending}>{enroll.isPending ? "Processing..." : "Submit Enrollment"}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function StudentPage() {
  const { user } = useAuth();
  const [target, setTarget] = useState<EnrollmentTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const own = useQuery<OwnStudent>({ queryKey: ["student-me"], queryFn: async () => (await api.get("/students/me")).data.data, enabled: user?.role === "student" });
  const list = useQuery({ queryKey: ["students"], queryFn: () => listResource<StudentSummary>("/students"), enabled: user?.role !== "student" });

  function openEnrollment(student: EnrollmentTarget) {
    setTarget(student);
  }

  if (user?.role === "student") {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Student Portal</h2>
          <Button disabled={!own.data} onClick={() => own.data && openEnrollment({ id: own.data.student_id, label: own.data.student_number })}>
            <Camera size={16} /> Enroll My Face
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-sm text-slate-500">Student Number</p><p className="mt-2 text-2xl font-bold">{own.data?.student_number}</p></Card>
          <Card><p className="text-sm text-slate-500">Attendance Percentage</p><p className="mt-2 text-2xl font-bold text-brand-700">{own.data?.attendance_percentage ?? 0}%</p></Card>
          <Card><p className="text-sm text-slate-500">Enrolled Courses</p><p className="mt-2 text-2xl font-bold">2</p></Card>
        </div>
        <FaceEnrollmentModal target={target} onClose={() => setTarget(null)} onSuccess={setToast} />
        <Toast message={toast} />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold">Students</h2><p className="text-sm text-slate-500">Register students, enroll face images, and inspect attendance.</p></div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-3">Number</th><th className="px-3 py-3">Student</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Year</th><th className="px-3 py-3">Face Enrollment</th></tr>
            </thead>
            <tbody>
              {list.data?.items.map((student) => (
                <tr key={student.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-900">{student.student_number}</td>
                  <td className="px-3 py-3">{student.user?.full_name ?? "Student"}</td>
                  <td className="px-3 py-3">{student.department_id}</td>
                  <td className="px-3 py-3">{student.enrollment_year}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => openEnrollment({ id: student.id, label: student.student_number })} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                        <Upload size={16} /> Enroll
                      </Button>
                      <Button onClick={() => openEnrollment({ id: student.id, label: student.student_number, replaceExisting: true })} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                        <RefreshCw size={16} /> Re-enroll
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <FaceEnrollmentModal target={target} onClose={() => setTarget(null)} onSuccess={setToast} />
      <Toast message={toast} />
    </div>
  );
}
