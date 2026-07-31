import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Filter,
  Layers,
  MapPin,
  Play,
  Plus,
  Radio,
  Search,
  StopCircle,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { api, listResource } from "../../lib/api";

interface SessionItem {
  id: number;
  subject_assignment_id: number;
  classroom_id: number;
  session_date: string;
  start_time: string;
  end_time?: string | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
  created_at: string;
  subject_assignment?: {
    section?: string;
    academic_year?: string;
    subject?: { code?: string; name?: string };
    faculty?: { employee_id?: string; user?: { full_name?: string } };
  };
  classroom?: { name?: string; building?: string };
}

interface OptionItem {
  id: number;
  name?: string;
  code?: string;
  section?: string;
  building?: string;
  employee_id?: string;
  subject?: { code?: string; name?: string };
  faculty?: { user?: { full_name?: string } };
}

export function SessionManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  // Modal States
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionItem | null>(null);

  // Form States
  const [subjectAssignmentId, setSubjectAssignmentId] = useState<string>("");
  const [classroomId, setClassroomId] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("");
  const [status, setStatus] = useState<"SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED">("IN_PROGRESS");
  const [notes, setNotes] = useState<string>("");

  // Queries
  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions", page, search, statusFilter],
    queryFn: async () => {
      const res = await api.get("/attendance/sessions", {
        params: { p: page, size: 20, search: search.trim() || undefined }
      });
      return res.data;
    }
  });

  const assignmentsQuery = useQuery({
    queryKey: ["subject-assignments-select"],
    queryFn: () => listResource<OptionItem>("/subject-assignments", { p: 1, size: 100 })
  });

  const classroomsQuery = useQuery({
    queryKey: ["classrooms-select"],
    queryFn: () => listResource<OptionItem>("/classrooms", { p: 1, size: 100 })
  });

  const sessions: SessionItem[] = useMemo(() => sessionsQuery.data?.items ?? [], [sessionsQuery.data]);
  const total: number = sessionsQuery.data?.total ?? 0;

  // Filtered List
  const filteredSessions = useMemo(() => {
    if (statusFilter === "ALL") return sessions;
    return sessions.filter((s) => s.status === statusFilter);
  }, [sessions, statusFilter]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        subject_assignment_id: Number(subjectAssignmentId),
        classroom_id: Number(classroomId),
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime || null,
        status,
        notes: notes || null
      };
      return (await api.post("/attendance/sessions", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
      setToast("Attendance session created successfully");
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setToast(err?.response?.data?.detail || "Failed to create session");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      const payload = {
        subject_assignment_id: Number(subjectAssignmentId),
        classroom_id: Number(classroomId),
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime || null,
        status,
        notes: notes || null
      };
      return (await api.patch(`/attendance/sessions/${id}`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
      setToast("Session updated successfully");
      setEditingSession(null);
      resetForm();
    },
    onError: (err: any) => {
      setToast(err?.response?.data?.detail || "Failed to update session");
    }
  });

  const endSessionMutation = useMutation({
    mutationFn: async (session: SessionItem) => {
      const now = new Date();
      const currentFormattedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      return (
        await api.patch(`/attendance/sessions/${session.id}`, {
          status: "COMPLETED",
          end_time: currentFormattedTime
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
      setToast("Live session ended successfully");
    },
    onError: (err: any) => {
      setToast(err?.response?.data?.detail || "Failed to end session");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await api.delete(`/attendance/sessions/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
      setToast("Session deleted cleanly");
    },
    onError: (err: any) => {
      setToast(err?.response?.data?.detail || "Failed to delete session");
    }
  });

  function resetForm() {
    setSubjectAssignmentId("");
    setClassroomId("");
    setSessionDate(new Date().toISOString().slice(0, 10));
    setStartTime("09:00");
    setEndTime("");
    setStatus("IN_PROGRESS");
    setNotes("");
  }

  function openEdit(session: SessionItem) {
    setEditingSession(session);
    setSubjectAssignmentId(String(session.subject_assignment_id));
    setClassroomId(String(session.classroom_id));
    setSessionDate(session.session_date);
    setStartTime(session.start_time);
    setEndTime(session.end_time || "");
    setStatus(session.status);
    setNotes(session.notes || "");
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600">
            <Layers size={15} />
            Administrative Control
          </div>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 tracking-tight">Attendance Sessions Hub</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Monitor active live classes, schedule upcoming sessions, modify details, or terminate sessions.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="shrink-0"
        >
          <Plus size={16} />
          Create / Schedule Session
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Live</span>
            <Radio size={18} className="text-emerald-600 animate-pulse" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900">
            {sessions.filter((s) => s.status === "IN_PROGRESS").length}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Scheduled</span>
            <Clock size={18} className="text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900">
            {sessions.filter((s) => s.status === "SCHEDULED").length}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-l-zinc-400">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Completed</span>
            <CheckCircle2 size={18} className="text-zinc-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900">
            {sessions.filter((s) => s.status === "COMPLETED").length}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cancelled</span>
            <XCircle size={18} className="text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900">
            {sessions.filter((s) => s.status === "CANCELLED").length}
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-semibold text-zinc-600 w-full md:w-auto">
            {["ALL", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "CANCELLED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  statusFilter === st ? "bg-white text-zinc-900 shadow-sm font-bold" : "hover:text-zinc-900"
                }`}
              >
                {st === "ALL" ? "All Sessions" : st.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search subject, instructor..."
              className="pl-9 text-xs"
            />
          </div>
        </div>
      </Card>

      {/* Sessions Table */}
      <Card className="overflow-hidden p-0 border border-zinc-200/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 font-semibold">
              <tr>
                <th className="px-4 py-3.5">Session ID / Date</th>
                <th className="px-4 py-3.5">Subject & Class</th>
                <th className="px-4 py-3.5">Instructor</th>
                <th className="px-4 py-3.5">Classroom</th>
                <th className="px-4 py-3.5">Time Window</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {sessionsQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    Loading sessions...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    No attendance sessions found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-zinc-50/80 transition-colors">
                    {/* ID & Date */}
                    <td className="px-4 py-3 font-mono font-semibold text-zinc-900">
                      <div>#SESS-{sess.id}</div>
                      <div className="text-xs font-normal text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={12} />
                        {sess.session_date}
                      </div>
                    </td>

                    {/* Subject */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900">
                        {sess.subject_assignment?.subject?.code || "Subject"}{" "}
                        <span className="font-normal text-zinc-500">— {sess.subject_assignment?.subject?.name}</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Section: {sess.subject_assignment?.section || "A"} ({sess.subject_assignment?.academic_year || "2026"})
                      </div>
                    </td>

                    {/* Instructor */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-800">
                        {sess.subject_assignment?.faculty?.user?.full_name || "Faculty Member"}
                      </div>
                      <div className="text-xs text-zinc-400 font-mono">
                        {sess.subject_assignment?.faculty?.employee_id}
                      </div>
                    </td>

                    {/* Classroom */}
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1 font-medium text-zinc-800">
                        <MapPin size={13} className="text-zinc-400" />
                        {sess.classroom?.name || `Room ${sess.classroom_id}`}
                      </div>
                      <div className="text-xs text-zinc-400">{sess.classroom?.building}</div>
                    </td>

                    {/* Time Window */}
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                      <div>
                        {sess.start_time} - {sess.end_time || "Ongoing"}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3">
                      {sess.status === "IN_PROGRESS" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/80">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          IN PROGRESS
                        </span>
                      )}
                      {sess.status === "SCHEDULED" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80">
                          <Clock size={12} />
                          SCHEDULED
                        </span>
                      )}
                      {sess.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 border border-zinc-200">
                          <CheckCircle2 size={12} />
                          COMPLETED
                        </span>
                      )}
                      {sess.status === "CANCELLED" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200/80">
                          <XCircle size={12} />
                          CANCELLED
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {sess.status === "IN_PROGRESS" && (
                          <button
                            type="button"
                            onClick={() => endSessionMutation.mutate(sess)}
                            disabled={endSessionMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 border border-red-200/80 transition-all shadow-sm"
                            title="End active session"
                          >
                            <StopCircle size={13} />
                            End
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(sess)}
                          className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 border border-zinc-200/80 transition-all shadow-sm"
                          title="Edit session details"
                        >
                          <Edit size={13} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete attendance session #SESS-${sess.id}?`)) {
                              deleteMutation.mutate(sess.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 border border-red-200/80 transition-all shadow-sm"
                          title="Delete session"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editingSession ? `Modify Session #SESS-${editingSession.id}` : "Create Attendance Session"}
        open={createOpen || Boolean(editingSession)}
        onClose={() => {
          setCreateOpen(false);
          setEditingSession(null);
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editingSession) {
              updateMutation.mutate(editingSession.id);
            } else {
              createMutation.mutate();
            }
          }}
          className="space-y-4"
        >
          {/* Subject Assignment Select */}
          <label className="block text-xs font-medium text-zinc-700">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500 font-semibold">Subject & Class Assignment</span>
            <select
              value={subjectAssignmentId}
              onChange={(e) => setSubjectAssignmentId(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">Select Subject Assignment...</option>
              {assignmentsQuery.data?.items?.map((asg) => (
                <option key={asg.id} value={asg.id}>
                  {asg.subject?.code} - {asg.subject?.name} (Sec {asg.section}) — {asg.faculty?.user?.full_name}
                </option>
              ))}
            </select>
          </label>

          {/* Classroom Select */}
          <label className="block text-xs font-medium text-zinc-700">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500 font-semibold">Classroom</span>
            <select
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">Select Classroom...</option>
              {classroomsQuery.data?.items?.map((cr) => (
                <option key={cr.id} value={cr.id}>
                  {cr.name} ({cr.building})
                </option>
              ))}
            </select>
          </label>

          {/* Date and Time Row */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-zinc-700">
              <span className="mb-1 block uppercase tracking-wider text-zinc-500 font-semibold">Session Date</span>
              <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
            </label>

            <label className="block text-xs font-medium text-zinc-700">
              <span className="mb-1 block uppercase tracking-wider text-zinc-500 font-semibold">Start Time</span>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </label>

            <label className="block text-xs font-medium text-zinc-700">
              <span className="mb-1 block uppercase tracking-wider text-zinc-500 font-semibold">End Time</span>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="Optional" />
            </label>
          </div>

          {/* Status Select */}
          <label className="block text-xs font-medium text-zinc-700">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500 font-semibold">Session Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="IN_PROGRESS">IN_PROGRESS (Live Active)</option>
              <option value="SCHEDULED">SCHEDULED (Upcoming)</option>
              <option value="COMPLETED">COMPLETED (Finished)</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>

          {/* Notes */}
          <label className="block text-xs font-medium text-zinc-700">
            <span className="mb-1 block uppercase tracking-wider text-zinc-500 font-semibold">Notes / Remarks</span>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Lab Session 4, Midterm exam attendance..." />
          </label>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreateOpen(false);
                setEditingSession(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Session"}
            </Button>
          </div>
        </form>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
