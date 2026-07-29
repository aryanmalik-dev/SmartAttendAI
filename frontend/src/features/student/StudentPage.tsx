import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Building2,
  Camera,
  CameraOff,
  ChevronRight,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  PencilLine,
  Plus,
  RefreshCw,
  Upload,
  UserCheck,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { api, downloadFromResponse, exportResource, listResource } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { registerWebcamStop } from "../../lib/webcam";

type StudentSummary = {
  id: number;
  admission_no?: string;
  student_number?: string;
  roll_no?: string | null;
  date_of_birth?: string | null;
  student_mobile?: string | null;
  father_mobile?: string | null;
  guardian_email?: string | null;
  department_id: number;
  course_id?: number;
  enrollment_year: number;
  semester?: number;
  section?: string;
  batch?: string;
  full_name?: string;
  email?: string;
  face_embedding_count?: number;
  user?: { full_name: string; email: string };
};

type DepartmentOption = {
  id: number;
  name: string;
  abbreviation: string;
  course_id: number | null;
};

type CourseOption = {
  id: number;
  name: string;
  abbreviation: string;
  is_active: boolean;
};

type SubjectAssignmentOption = {
  id: number;
  faculty_id: number;
  subject_id: number;
  section: string;
  academic_year: string;
  faculty?: { id: number; employee_id: string; user?: { id: number; full_name: string; email: string } };
  subject?: { id: number; code: string; name: string; course_id: number; department_id: number };
};

type OwnStudent = {
  student_id: number;
  admission_no?: string;
  student_number?: string;
  roll_no?: string | null;
  date_of_birth?: string | null;
  student_mobile?: string | null;
  father_mobile?: string | null;
  email?: string;
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

const studentCreateSchema = z.object({
  full_name: z.string().min(2, "Enter the student's full name"),
  admission_no: z.string().min(2, "Enter an admission number"),
  roll_no: z.string().min(1, "Enter a roll number"),
  date_of_birth: z.string().min(1, "Enter a date of birth"),
  student_mobile: z.string().min(5, "Enter a student mobile number"),
  father_mobile: z.string().min(5, "Enter a father mobile number"),
  course_id: z.coerce.number().int().positive("Select a course"),
  department_id: z.coerce.number().int().positive("Select a department"),
  enrollment_year: z.coerce.number().int().min(2000).max(2100),
  semester: z.coerce.number().int().min(1).max(12),
  section: z.string().min(1).max(10),
  batch: z.string().min(1).max(10),
});

type StudentCreateFormValues = z.infer<typeof studentCreateSchema>;

const studentEditSchema = z.object({
  full_name: z.string().min(2, "Enter the student's full name"),
  roll_no: z.string().min(1, "Enter a roll number"),
  date_of_birth: z.string().optional(),
  student_mobile: z.string().optional(),
  father_mobile: z.string().optional(),
  guardian_email: z.string().email().optional().or(z.literal("")),
  semester: z.string().optional(),
  section: z.string().optional(),
  batch: z.string().optional(),
});

type StudentEditFormValues = z.infer<typeof studentEditSchema>;

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string; message?: string } } }).response;
    return response?.data?.detail ?? response?.data?.message ?? "Operation failed";
  }
  return "Operation failed";
}

function studentName(student: StudentSummary) {
  return student.full_name ?? student.user?.full_name ?? "Student";
}

function StudentCreateModal({
  open,
  onClose,
  onSuccess,
  defaultCourseId,
  defaultDepartmentId,
  defaultSection
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  defaultCourseId?: number | null;
  defaultDepartmentId?: number | null;
  defaultSection?: string | null;
}) {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<StudentCreateFormValues>({
    resolver: zodResolver(studentCreateSchema),
    defaultValues: {
      admission_no: "",
      roll_no: "",
      date_of_birth: "",
      student_mobile: "",
      father_mobile: "",
      course_id: defaultCourseId ?? undefined,
      department_id: defaultDepartmentId ?? undefined,
      enrollment_year: new Date().getFullYear(),
      semester: 1,
      section: defaultSection ?? "",
      batch: `${new Date().getFullYear()}-${new Date().getFullYear() + 4}`,
    }
  });

  const coursesQuery = useQuery({
    queryKey: ["student-create-courses"],
    queryFn: () => listResource<CourseOption>("/courses", { p: 1, size: 100 }),
    enabled: open
  });

  const departmentsQuery = useQuery({
    queryKey: ["student-create-departments"],
    queryFn: () => listResource<DepartmentOption>("/departments", { p: 1, size: 100 }),
    enabled: open
  });

  const selectedCourseId = form.watch("course_id");

  const filteredDepartments = useMemo(() => {
    const departments = departmentsQuery.data?.items ?? [];
    if (!selectedCourseId) return departments;
    return departments.filter((department) => department.course_id === selectedCourseId);
  }, [departmentsQuery.data?.items, selectedCourseId]);

  useEffect(() => {
    if (open) {
      if (defaultCourseId) form.setValue("course_id", defaultCourseId);
      if (defaultDepartmentId) form.setValue("department_id", defaultDepartmentId);
      if (defaultSection) form.setValue("section", defaultSection);
      setErrorMsg(null);
    }
  }, [defaultCourseId, defaultDepartmentId, defaultSection, form, open]);

  const createStudent = useMutation({
    mutationFn: async (values: StudentCreateFormValues) => {
      const payload = {
        ...values,
        date_of_birth: values.date_of_birth || null,
        student_mobile: values.student_mobile || null,
        father_mobile: values.father_mobile || null
      };
      const { data } = await api.post("/students", payload);
      return data.data as { id: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onSuccess("Student created successfully");
      onClose();
      form.reset();
    },
    onError: (err) => {
      setErrorMsg(errorMessage(err));
    }
  });

  const admissionNo = form.watch("admission_no");
  const generatedEmail = admissionNo ? `${admissionNo}@imsec.ac.in` : "";

  return (
    <Modal title="Add New Student (Admin Only)" open={open} onClose={onClose}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((values) => {
          setErrorMsg(null);
          createStudent.mutate(values);
        })}
      >
        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Full Name *</span>
          <Input {...form.register("full_name")} placeholder="e.g. Rahul Verma" />
          {form.formState.errors.full_name && <span className="text-xs text-red-600">{form.formState.errors.full_name.message}</span>}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Admission No. (Unique) *</span>
          <Input {...form.register("admission_no")} placeholder="e.g. ADM2024001" />
          {form.formState.errors.admission_no && <span className="text-xs text-red-600">{form.formState.errors.admission_no.message}</span>}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Roll No. (Unique) *</span>
          <Input {...form.register("roll_no")} placeholder="e.g. 2100320100045" />
          {form.formState.errors.roll_no && <span className="text-xs text-red-600">{form.formState.errors.roll_no.message}</span>}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Date of Birth *</span>
          <Input type="date" {...form.register("date_of_birth")} />
          {form.formState.errors.date_of_birth && <span className="text-xs text-red-600">{form.formState.errors.date_of_birth.message}</span>}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Course *</span>
          <select {...form.register("course_id")} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Select course</option>
            {coursesQuery.data?.items.map((course) => (
              <option key={course.id} value={course.id}>
                {course.abbreviation} - {course.name}
              </option>
            ))}
          </select>
          {form.formState.errors.course_id && <span className="text-xs text-red-600">{form.formState.errors.course_id.message}</span>}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Department *</span>
          <select {...form.register("department_id")} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">{selectedCourseId ? "Select department" : "Select department"}</option>
            {filteredDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.abbreviation} - {department.name}
              </option>
            ))}
          </select>
          {form.formState.errors.department_id && <span className="text-xs text-red-600">{form.formState.errors.department_id.message}</span>}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Enrollment Year *</span>
          <Input type="number" {...form.register("enrollment_year")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Semester *</span>
          <Input type="number" {...form.register("semester")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Section *</span>
          <Input {...form.register("section")} placeholder="e.g. A" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Batch *</span>
          <Input {...form.register("batch")} placeholder="e.g. 2024-2028" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Student Mobile *</span>
          <Input {...form.register("student_mobile")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Father Mobile *</span>
          <Input {...form.register("father_mobile")} />
        </label>

        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Auto-Generated Email</span>
          <Input value={generatedEmail} readOnly className="bg-slate-50 text-slate-600" />
        </label>

        {errorMsg && (
          <div className="sm:col-span-2 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700 border border-red-200">
            {errorMsg}
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end gap-3">
          <Button type="button" onClick={onClose} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
            Cancel
          </Button>
          <Button type="submit" disabled={createStudent.isPending || coursesQuery.isLoading || departmentsQuery.isLoading}>
            {createStudent.isPending ? "Creating..." : "Create Student"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StudentEditModal({
  open,
  student,
  onClose,
  onSuccess
}: {
  open: boolean;
  student: StudentSummary | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<StudentEditFormValues>({
    resolver: zodResolver(studentEditSchema),
    defaultValues: {
      full_name: "",
      roll_no: "",
      date_of_birth: "",
      student_mobile: "",
      father_mobile: "",
      guardian_email: "",
      semester: "",
      section: "",
      batch: "",
    }
  });

  useEffect(() => {
    if (!student) return;
    form.reset({
      full_name: student.full_name ?? student.user?.full_name ?? "",
      roll_no: student.roll_no ?? "",
      date_of_birth: student.date_of_birth ?? "",
      student_mobile: student.student_mobile ?? "",
      father_mobile: student.father_mobile ?? "",
      guardian_email: student.guardian_email ?? "",
      semester: student.semester?.toString() ?? "",
      section: student.section ?? "",
      batch: student.batch ?? "",
    });
    setErrorMsg(null);
  }, [form, student]);

  const updateStudent = useMutation({
    mutationFn: async (values: StudentEditFormValues) => {
      if (!student) return null;
      const payload = {
        full_name: values.full_name.trim(),
        roll_no: values.roll_no.trim(),
        date_of_birth: values.date_of_birth || undefined,
        student_mobile: values.student_mobile?.trim() || undefined,
        father_mobile: values.father_mobile?.trim() || undefined,
        guardian_email: values.guardian_email?.trim() || undefined,
        semester: values.semester?.trim() ? Number(values.semester) : undefined,
        section: values.section?.trim() || undefined,
        batch: values.batch?.trim() || undefined,
      };
      const { data } = await api.patch(`/students/${student.id}`, payload);
      return data.data as StudentSummary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onSuccess("Student record updated successfully");
      onClose();
    },
    onError: (err) => {
      setErrorMsg(errorMessage(err));
    }
  });

  if (!student) return null;

  return (
    <Modal title="Edit Student Info" open={open} onClose={onClose}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => { setErrorMsg(null); updateStudent.mutate(values); })}>
        <div className="sm:col-span-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Admission No. (Immutable)</p>
              <p className="mt-1 font-semibold text-slate-900">{student.admission_no ?? student.student_number}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
              <p className="mt-1 truncate font-medium text-slate-900">{student.email ?? "—"}</p>
            </div>
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Full Name *</span>
          <Input {...form.register("full_name")} />
          {form.formState.errors.full_name && <span className="text-xs text-red-600">{form.formState.errors.full_name.message}</span>}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Roll No. (Unique) *</span>
          <Input {...form.register("roll_no")} />
          {form.formState.errors.roll_no && <span className="text-xs text-red-600">{form.formState.errors.roll_no.message}</span>}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Date of Birth</span>
          <Input type="date" {...form.register("date_of_birth")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Student Mobile</span>
          <Input {...form.register("student_mobile")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Father Mobile</span>
          <Input {...form.register("father_mobile")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Guardian Email</span>
          <Input {...form.register("guardian_email")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Semester</span>
          <Input {...form.register("semester")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Section</span>
          <Input {...form.register("section")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Batch</span>
          <Input {...form.register("batch")} />
        </label>

        {errorMsg && (
          <div className="sm:col-span-2 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700 border border-red-200">
            {errorMsg}
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end gap-3">
          <Button type="button" onClick={onClose} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
            Cancel
          </Button>
          <Button type="submit" disabled={updateStudent.isPending}>
            {updateStudent.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FaceEnrollmentModal({ target, onClose, onSuccess }: { target: EnrollmentTarget | null; onClose: () => void; onSuccess: (message: string) => void }) {
  const [mode, setMode] = useState<"upload" | "webcam">("upload");
  const [items, setItems] = useState<ImageItem[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
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
      setCameraActive(true);
    } catch {
      setCameraActive(false);
      setError("Camera access was blocked or unavailable.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  async function toggleCamera() {
    if (streamRef.current) {
      stopCamera();
      return;
    }
    await startCamera();
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
    if (items.length > 5) {
      setError("Maximum 5 face images can be uploaded per student.");
      return;
    }
    enroll.mutate();
  }

  useEffect(() => {
    setReplaceExisting(Boolean(target?.replaceExisting));
    if (!target) stopCamera();
    return () => stopCamera();
  }, [target]);

  useEffect(() => {
    if (mode !== "webcam") stopCamera();
  }, [mode]);

  useEffect(() => {
    const unregister = registerWebcamStop(stopCamera);
    return () => unregister();
  }, []);

  return (
    <Modal title={`Face Enrollment - ${target?.label ?? ""}`} open={Boolean(target)} onClose={closeAndReset}>
      <div className="space-y-5">
        <p className="text-xs font-medium text-slate-500">
          Upload up to 5 clear face images (Front, Left 45°, Right 45°, Neutral, Smile) for optimal recognition accuracy.
        </p>

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
              <Button type="button" onClick={toggleCamera}>{cameraActive ? <CameraOff size={16} /> : <Camera size={16} />}{cameraActive ? " Stop Webcam" : " Start Webcam"}</Button>
              <Button type="button" onClick={captureFrame} disabled={!cameraActive} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"><Upload size={16} /> Capture Image</Button>
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
  const queryClient = useQueryClient();
  const isStudent = Boolean(user?.roles.includes("student"));
  const isAdmin = Boolean(user?.roles.includes("admin"));
  const isFaculty = Boolean(user?.roles.includes("faculty"));

  // Strict Permissions: Only Admin can create or import students
  const canCreateStudent = isAdmin;
  const canManageImports = isAdmin;

  // Hierarchical Navigation States: Course -> Department -> Section
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedClassCard, setSelectedClassCard] = useState<SubjectAssignmentOption | null>(null);

  const [target, setTarget] = useState<EnrollmentTarget | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<"roll_no" | "admission_no" | "student">("roll_no");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const pageSize = 50;

  const own = useQuery<OwnStudent>({
    queryKey: ["student-me"],
    queryFn: async () => (await api.get("/students/me")).data.data,
    enabled: isStudent
  });

  const coursesQuery = useQuery({
    queryKey: ["student-page-courses"],
    queryFn: () => listResource<CourseOption>("/courses", { p: 1, size: 100 }),
    enabled: !isStudent
  });

  const departmentsQuery = useQuery({
    queryKey: ["student-page-departments"],
    queryFn: () => listResource<DepartmentOption>("/departments", { p: 1, size: 100 }),
    enabled: !isStudent
  });

  const assignmentsQuery = useQuery({
    queryKey: ["faculty-subject-assignments"],
    queryFn: () => listResource<SubjectAssignmentOption>("/subject-assignments", { p: 1, size: 100 }),
    enabled: isFaculty
  });

  const courseById = useMemo(
    () => new Map((coursesQuery.data?.items ?? []).map((course) => [course.id, course])),
    [coursesQuery.data?.items]
  );

  const departmentById = useMemo(
    () => new Map((departmentsQuery.data?.items ?? []).map((department) => [department.id, department])),
    [departmentsQuery.data?.items]
  );

  const filteredDepartments = useMemo(() => {
    const items = departmentsQuery.data?.items ?? [];
    if (!selectedCourseId) return items;
    return items.filter((dept) => dept.course_id === selectedCourseId);
  }, [departmentsQuery.data?.items, selectedCourseId]);

  // Filter assignments for Faculty
  const facultyAssignments = useMemo(() => {
    const items = assignmentsQuery.data?.items ?? [];
    if (!user) return [];
    return items.filter(
      (item) =>
        item.faculty?.user?.id === user.id ||
        (item.faculty?.user?.email && item.faculty.user.email.toLowerCase() === user.email.toLowerCase())
    );
  }, [assignmentsQuery.data?.items, user]);

  // Query students filtered by active hierarchical selections
  const studentsParams = useMemo(() => {
    const params: Record<string, string | number> = {
      p: page,
      size: pageSize,
      sort: `${sortField}${sortDirection === "desc" ? ":desc" : ""}`
    };
    if (selectedCourseId) params.course_id = selectedCourseId;
    if (selectedDepartmentId) params.department_id = selectedDepartmentId;
    if (selectedSection) params.section = selectedSection;
    return params;
  }, [page, selectedCourseId, selectedDepartmentId, selectedSection, sortDirection, sortField]);

  const list = useQuery({
    queryKey: ["students", studentsParams],
    queryFn: () => listResource<StudentSummary>("/students", studentsParams),
    enabled: !isStudent && (isAdmin ? true : Boolean(selectedSection || selectedDepartmentId))
  });

  // Extract distinct sections for the selected department
  const availableSections = useMemo(() => {
    if (!selectedDepartmentId) return [];
    const items = list.data?.items ?? [];
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.section) set.add(item.section);
    });
    return Array.from(set).sort();
  }, [list.data?.items, selectedDepartmentId]);

  function openEnrollment(student: EnrollmentTarget) {
    setTarget(student);
  }

  function toggleSort(field: "roll_no" | "admission_no" | "student") {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        setPage(1);
        return currentField;
      }
      setSortDirection("asc");
      setPage(1);
      return field;
    });
  }

  function sortIcon(field: "roll_no" | "admission_no" | "student") {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-slate-400" />;
    return sortDirection === "asc" ? <ArrowUp size={14} className="text-brand-600" /> : <ArrowDown size={14} className="text-brand-600" />;
  }

  async function handleImport(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const params: Record<string, string | number> = {};
    if (selectedDepartmentId) params.department_id = selectedDepartmentId;
    if (selectedCourseId) params.course_id = selectedCourseId;

    try {
      const { data } = await api.post<{ success: boolean; message: string; data: { inserted: number; failed: number; errors: { row: number; errors: string[] }[] } }>(
        "/students/import",
        formData,
        { params, headers: { "Content-Type": "multipart/form-data" } }
      );
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      const inserted = data.data?.inserted ?? 0;
      const failed = data.data?.failed ?? 0;
      const errorMsg = data.data?.errors?.length ? ` (${data.data.errors[0].errors[0]})` : "";
      setToast(`Import finished: ${inserted} inserted, ${failed} failed${errorMsg}`);
    } catch (err) {
      setToast(`Import failed: ${errorMessage(err)}`);
    }
  }

  // Student Self-Service Portal
  if (isStudent) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Student Portal</h2>
          <Button disabled={!own.data} onClick={() => own.data && openEnrollment({ id: own.data.student_id, label: own.data.admission_no ?? own.data.student_number ?? "" })}>
            <Camera size={16} /> Enroll My Face
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-sm text-slate-500">Admission No.</p><p className="mt-2 text-2xl font-bold">{own.data?.admission_no ?? own.data?.student_number}</p></Card>
          <Card><p className="text-sm text-slate-500">Attendance Percentage</p><p className="mt-2 text-2xl font-bold text-brand-700">{own.data?.attendance_percentage ?? 0}%</p></Card>
          <Card><p className="text-sm text-slate-500">Email</p><p className="mt-2 truncate text-xl font-semibold">{own.data?.email ?? "—"}</p></Card>
        </div>
        <FaceEnrollmentModal target={target} onClose={() => setTarget(null)} onSuccess={setToast} />
        <Toast message={toast} />
      </div>
    );
  }

  // FACULTY VIEW: Assigned Classes Card Grid & Roster
  if (isFaculty) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">My Classes</h2>
            <p className="text-sm text-slate-500">
              Select an assigned class to view student rosters, inspect attendance, or manage face enrollment.
            </p>
          </div>
        </div>

        {/* Level 1: Assigned Classes Card View */}
        {!selectedClassCard && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">Assigned Subject & Section Cards</h3>
            {facultyAssignments.length === 0 ? (
              <Card>
                <div className="p-8 text-center text-slate-500">
                  <Users className="mx-auto mb-3 text-slate-400" size={36} />
                  <p className="text-base font-semibold text-slate-700">No Subject Assignments Found</p>
                  <p className="text-sm">Contact your system administrator to assign subjects and sections to your profile.</p>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {facultyAssignments.map((assignment) => {
                  const subjectName = assignment.subject?.name ?? "Subject";
                  const subjectCode = assignment.subject?.code ?? `SUB-${assignment.subject_id}`;
                  const dept = departmentById.get(assignment.subject?.department_id ?? 0);
                  const crs = courseById.get(assignment.subject?.course_id ?? 0);

                  return (
                    <div
                      key={assignment.id}
                      onClick={() => {
                        setSelectedClassCard(assignment);
                        setSelectedSection(assignment.section);
                        if (assignment.subject?.department_id) setSelectedDepartmentId(assignment.subject.department_id);
                        if (assignment.subject?.course_id) setSelectedCourseId(assignment.subject.course_id);
                        setPage(1);
                      }}
                      className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                          <BookOpen size={20} />
                        </div>
                        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-800">
                          Section {assignment.section}
                        </span>
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-slate-900">{subjectCode}</h3>
                      <p className="text-sm font-medium text-slate-700">{subjectName}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <span>{crs ? crs.abbreviation : ""} {dept ? `• ${dept.abbreviation}` : ""}</span>
                        <span className="font-semibold">{assignment.academic_year}</span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-brand-600 group-hover:underline">View Class Roster &rarr;</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Level 2: Faculty Roster View for Selected Class */}
        {selectedClassCard && (
          <div className="space-y-4">
            {/* Top Breadcrumb Navigation & Action Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClassCard(null);
                    setSelectedSection(null);
                    setSelectedDepartmentId(null);
                    setSelectedCourseId(null);
                  }}
                  className="inline-flex items-center gap-1.5 font-semibold text-brand-600 transition hover:text-brand-700 hover:underline"
                >
                  <ArrowLeft size={16} /> My Classes
                </button>
                <ChevronRight size={14} className="text-slate-400" />
                <span className="font-bold text-slate-900">
                  {selectedClassCard.subject?.code} - {selectedClassCard.subject?.name} (Section {selectedClassCard.section})
                </span>
              </div>

              <Button
                type="button"
                onClick={async () => {
                  try {
                    const params: Record<string, string | number> = { file_format: "csv" };
                    if (selectedCourseId) params.course_id = selectedCourseId;
                    if (selectedDepartmentId) params.department_id = selectedDepartmentId;
                    if (selectedSection) params.section = selectedSection;
                    const blob = await exportResource("/students/export", params);
                    downloadFromResponse(blob, `roster_${selectedClassCard.subject?.code ?? "class"}_sec_${selectedClassCard.section}.csv`);
                    setToast("Roster export started");
                  } catch {
                    setToast("Roster export failed");
                  }
                }}
                className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <FileSpreadsheet size={16} /> Export Roster
              </Button>
            </div>

            {/* Student Table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                    <col className="w-[35%]" />
                    <col className="w-[15%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">
                        <button type="button" onClick={() => toggleSort("roll_no")} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap">
                          Roll No. {sortIcon("roll_no")}
                        </button>
                      </th>
                      <th className="px-3 py-2">
                        <button type="button" onClick={() => toggleSort("admission_no")} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap">
                          Admission No. {sortIcon("admission_no")}
                        </button>
                      </th>
                      <th className="px-3 py-2">
                        <button type="button" onClick={() => toggleSort("student")} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap">
                          Student Name {sortIcon("student")}
                        </button>
                      </th>
                      <th className="px-3 py-2">Biometrics</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data?.items.map((student) => (
                      <tr key={student.id} className="border-t border-slate-100 align-middle">
                        <td className="px-3 py-2 font-mono font-medium text-slate-800">{student.roll_no ?? "—"}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{student.admission_no ?? student.student_number}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{studentName(student)}</td>
                        <td className="px-3 py-2">
                          {((student.face_embedding_count ?? 0) > 0) ? (
                            <Button onClick={() => openEnrollment({ id: student.id, label: student.admission_no ?? student.student_number ?? "", replaceExisting: true })} className="h-8 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                              <RefreshCw size={13} /> Re-enroll
                            </Button>
                          ) : (
                            <Button onClick={() => openEnrollment({ id: student.id, label: student.admission_no ?? student.student_number ?? "" })} className="h-8 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                              <Upload size={13} /> Enroll
                            </Button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            onClick={() => setEditingStudent(student)}
                            className="h-8 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                          >
                            <PencilLine size={13} /> Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600">
                <div>
                  {list.data?.total
                    ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, list.data.total)} of ${list.data.total}`
                    : "No students found in this selection"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1 || list.isFetching}
                    className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Previous
                  </Button>
                  <span className="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700">
                    Page {page} of {Math.max(1, Math.ceil((list.data?.total ?? 0) / pageSize))}
                  </span>
                  <Button
                    type="button"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={list.isFetching || page >= Math.max(1, Math.ceil((list.data?.total ?? 0) / pageSize))}
                    className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        <StudentEditModal
          open={Boolean(editingStudent)}
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSuccess={(message) => setToast(message)}
        />
        <FaceEnrollmentModal target={target} onClose={() => setTarget(null)} onSuccess={setToast} />
        <Toast message={toast} />
      </div>
    );
  }

  // ADMIN VIEW: Full Manage Students Hierarchical Hub
  const currentCourse = selectedCourseId ? courseById.get(selectedCourseId) : null;
  const currentDepartment = selectedDepartmentId ? departmentById.get(selectedDepartmentId) : null;

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Manage Students</h2>
          <p className="text-sm text-slate-500">
            Admin Management Console: Hierarchical course/department student enrollment & Excel imports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageImports && (
            <>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    const blob = await exportResource("/students/template", { file_format: "xlsx" });
                    downloadFromResponse(blob, "students_template.xlsx");
                    setToast("Student template download started");
                  } catch {
                    setToast("Student template download failed");
                  }
                }}
                className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <FileSpreadsheet size={16} /> Template
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
                <Upload size={16} />
                Import Excel
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    await handleImport(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </>
          )}
          {canCreateStudent && (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Add Student
            </Button>
          )}
        </div>
      </div>

      {/* Hierarchical Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setSelectedCourseId(null);
            setSelectedDepartmentId(null);
            setSelectedSection(null);
            setPage(1);
          }}
          className={`font-semibold transition hover:text-brand-600 ${!selectedCourseId ? "text-brand-700" : "text-slate-600"}`}
        >
          All Courses
        </button>

        {currentCourse && (
          <>
            <ChevronRight size={14} className="text-slate-400" />
            <button
              type="button"
              onClick={() => {
                setSelectedDepartmentId(null);
                setSelectedSection(null);
                setPage(1);
              }}
              className={`font-semibold transition hover:text-brand-600 ${!selectedDepartmentId ? "text-brand-700" : "text-slate-600"}`}
            >
              {currentCourse.abbreviation} ({currentCourse.name})
            </button>
          </>
        )}

        {currentDepartment && (
          <>
            <ChevronRight size={14} className="text-slate-400" />
            <button
              type="button"
              onClick={() => {
                setSelectedSection(null);
                setPage(1);
              }}
              className={`font-semibold transition hover:text-brand-600 ${!selectedSection ? "text-brand-700" : "text-slate-600"}`}
            >
              {currentDepartment.abbreviation} ({currentDepartment.name})
            </button>
          </>
        )}

        {selectedSection && (
          <>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-semibold text-brand-700">Section {selectedSection}</span>
          </>
        )}
      </div>

      {/* Level 1: Course Selection Cards */}
      {!selectedCourseId && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coursesQuery.data?.items.map((course) => (
            <div
              key={course.id}
              onClick={() => {
                setSelectedCourseId(course.id);
                setPage(1);
              }}
              className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <BookOpen size={20} />
                </div>
                <ChevronRight size={18} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{course.abbreviation}</h3>
              <p className="text-sm text-slate-500">{course.name}</p>
              <p className="mt-3 text-xs font-semibold text-brand-600">Click to view departments &rarr;</p>
            </div>
          ))}
        </div>
      )}

      {/* Level 2: Department Selection Cards */}
      {selectedCourseId && !selectedDepartmentId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Departments in {currentCourse?.abbreviation}</h3>
            <Button type="button" onClick={() => setSelectedCourseId(null)} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
              <ArrowLeft size={16} /> Back to Courses
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDepartments.map((dept) => (
              <div
                key={dept.id}
                onClick={() => {
                  setSelectedDepartmentId(dept.id);
                  setPage(1);
                }}
                className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
                    <Building2 size={20} />
                  </div>
                  <ChevronRight size={18} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{dept.abbreviation}</h3>
                <p className="text-sm text-slate-500">{dept.name}</p>
                <p className="mt-3 text-xs font-semibold text-brand-600">Click to view section rosters &rarr;</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Level 3 & 4: Student Roster Table & Filters */}
      {selectedCourseId && selectedDepartmentId && (
        <div className="space-y-4">
          {availableSections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide font-semibold text-slate-500">Filter Section:</span>
              <button
                type="button"
                onClick={() => setSelectedSection(null)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${!selectedSection ? "bg-brand-600 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"}`}
              >
                All Sections
              </button>
              {availableSections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSection(sec)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${selectedSection === sec ? "bg-brand-600 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"}`}
                >
                  Section {sec}
                </button>
              ))}
            </div>
          )}

          {/* Student Roster Table Card */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                  <col className="w-[28%]" />
                  <col className="w-[22%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">
                      <button type="button" onClick={() => toggleSort("roll_no")} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap">
                        Roll No. * {sortIcon("roll_no")}
                      </button>
                    </th>
                    <th className="px-3 py-2">
                      <button type="button" onClick={() => toggleSort("admission_no")} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap">
                        Admission No. * {sortIcon("admission_no")}
                      </button>
                    </th>
                    <th className="px-3 py-2">
                      <button type="button" onClick={() => toggleSort("student")} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap">
                        Student {sortIcon("student")}
                      </button>
                    </th>
                    <th className="px-3 py-2">Dept / Sec</th>
                    <th className="px-3 py-2 whitespace-nowrap">Year</th>
                    <th className="px-3 py-2">Biometrics</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data?.items.map((student) => (
                    <tr key={student.id} className="border-t border-slate-100 align-middle">
                      <td className="px-3 py-2 min-w-0 font-mono font-medium text-slate-800" title={student.roll_no ?? ""}>
                        {student.roll_no ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap" title={student.admission_no ?? student.student_number ?? ""}>
                        {student.admission_no ?? student.student_number}
                      </td>
                      <td className="px-3 py-2">
                        <div className="min-w-0 whitespace-normal break-words leading-tight text-slate-900 font-medium">
                          {studentName(student)}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="block min-w-0 truncate text-slate-700">
                          {currentDepartment?.abbreviation ?? `Dept ${student.department_id}`} (Sec {student.section ?? "A"})
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{student.enrollment_year}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-nowrap gap-1">
                          {((student.face_embedding_count ?? 0) > 0) ? (
                            <Button onClick={() => openEnrollment({ id: student.id, label: student.admission_no ?? student.student_number ?? "", replaceExisting: true })} className="h-8 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                              <RefreshCw size={13} /> Re-enroll
                            </Button>
                          ) : (
                            <Button onClick={() => openEnrollment({ id: student.id, label: student.admission_no ?? student.student_number ?? "" })} className="h-8 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
                              <Upload size={13} /> Enroll
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          onClick={() => setEditingStudent(student)}
                          className="h-8 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                        >
                          <PencilLine size={13} /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600">
              <div>
                {list.data?.total
                  ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, list.data.total)} of ${list.data.total}`
                  : "No students found in this selection"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || list.isFetching}
                  className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                >
                  Previous
                </Button>
                <span className="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700">
                  Page {page} of {Math.max(1, Math.ceil((list.data?.total ?? 0) / pageSize))}
                </span>
                <Button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={list.isFetching || page >= Math.max(1, Math.ceil((list.data?.total ?? 0) / pageSize))}
                  className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modals */}
      <StudentCreateModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["students"] });
        }}
        onSuccess={(message) => setToast(message)}
        defaultCourseId={selectedCourseId}
        defaultDepartmentId={selectedDepartmentId}
        defaultSection={selectedSection}
      />
      <StudentEditModal
        open={Boolean(editingStudent)}
        student={editingStudent}
        onClose={() => setEditingStudent(null)}
        onSuccess={(message) => setToast(message)}
      />
      <FaceEnrollmentModal target={target} onClose={() => setTarget(null)} onSuccess={setToast} />
      <Toast message={toast} />
    </div>
  );
}
