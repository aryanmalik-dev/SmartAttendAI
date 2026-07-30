import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Plus, Search, Upload } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { api, downloadFromResponse, exportResource, listResource } from "../../lib/api";
import { useMemo } from "react";

type DepartmentOption = {
  id: number;
  abbreviation: string;
  name: string;
};

type FacultyRow = {
  id: number;
  employee_id: string;
  department_id: number;
  designation: string | null;
  phone: string | null;
  user: {
    id?: number;
    full_name: string;
    email: string;
    is_active?: boolean;
    email_verified?: boolean;
  };
};

const createSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  employee_id: z.string().min(2),
  department_id: z.coerce.number().int().positive(),
  designation: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal(""))
});

const updateSchema = createSchema.extend({
  is_active: z.enum(["true", "false"]).optional()
});

type CreateValues = z.infer<typeof createSchema>;
type UpdateValues = z.infer<typeof updateSchema>;

function facultyPayload(values: CreateValues) {
  return {
    user: {
      full_name: values.full_name,
      email: values.email,
      password: values.password
    },
    employee_id: values.employee_id,
    department_id: values.department_id,
    designation: values.designation || null,
    phone: values.phone || null
  };
}

function mutationErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string; message?: string } } }).response;
    return response?.data?.detail ?? response?.data?.message ?? fallback;
  }
  return fallback;
}

export function FacultyPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FacultyRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["faculty", search, page],
    queryFn: () => listResource<FacultyRow>("/faculty", { search, p: page, size: 10 })
  });
  const departments = useQuery({
    queryKey: ["departments", "faculty-form"],
    queryFn: () => listResource<DepartmentOption>("/departments", { p: 1, size: 100 })
  });

  const createForm = useForm<CreateValues>({ resolver: zodResolver(createSchema) });
  const updateForm = useForm<UpdateValues>({ resolver: zodResolver(updateSchema) });

  const save = useMutation({
    mutationFn: async (values: CreateValues | UpdateValues) => {
      if (editing) {
        const editable = values as UpdateValues;
        const password = editable.password && editable.password.length > 0 ? editable.password : undefined;
        const payload = {
          ...editable,
          designation: editable.designation || null,
          phone: editable.phone || null,
          password,
          is_active: editable.is_active === undefined ? undefined : editable.is_active === "true"
        };
        const { data } = await api.patch(`/faculty/${editing.id}`, payload);
        return data.data as FacultyRow;
      }
      const { data } = await api.post("/faculty", facultyPayload(values as CreateValues));
      return data.data as FacultyRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faculty"] });
      setToast(editing ? "Faculty updated" : "Faculty created");
      setEditing(null);
      setOpen(false);
      createForm.reset();
      updateForm.reset();
    },
    onError: (error) => {
      setToast(mutationErrorMessage(error, editing ? "Faculty update failed" : "Faculty creation failed"));
    }
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/faculty/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faculty"] });
      setToast("Faculty deleted");
    },
    onError: (error) => {
      setToast(mutationErrorMessage(error, "Faculty deletion failed"));
    }
  });

  async function handleImport(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    await api.post("/faculty/import", formData, { headers: { "Content-Type": "multipart/form-data" } });
    queryClient.invalidateQueries({ queryKey: ["faculty"] });
    setToast("Faculty imported");
  }

  async function handleExport(format: "csv" | "xlsx") {
    try {
      const blob = await exportResource("/faculty/export", { file_format: format, search, p: page });
      downloadFromResponse(blob, `faculty.${format}`);
      setToast("Faculty export started");
    } catch {
      setToast("Faculty export failed");
    }
  }

  async function handleTemplate(format: "csv" | "xlsx") {
    try {
      const blob = await exportResource("/faculty/template", { file_format: format });
      downloadFromResponse(blob, `faculty_template.${format}`);
      setToast("Faculty template download started");
    } catch {
      setToast("Faculty template download failed");
    }
  }

  function openCreate() {
    setEditing(null);
    createForm.reset();
    setOpen(true);
  }

  function openEdit(row: FacultyRow) {
    setEditing(row);
      updateForm.reset({
        full_name: row.user.full_name,
        email: row.user.email,
        password: "",
        employee_id: row.employee_id,
        department_id: row.department_id,
        designation: row.designation ?? "",
        phone: row.phone ?? "",
        is_active: (row.user.is_active ?? true) ? "true" : "false"
      });
    setOpen(true);
  }

  const departmentItems = departments.data?.items ?? [];
  const departmentById = useMemo(() => new Map(departmentItems.map((department) => [department.id, department])), [departmentItems]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Faculty</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Faculty Management</h2>
          <p className="mt-1 text-sm text-slate-500">Register faculty, search records, and manage imports and exports.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Add Faculty
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
          <Search size={18} className="text-zinc-400 shrink-0" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search faculty by name, employee ID, email, or department..."
            className="border-0 px-0 focus:ring-0 text-sm text-zinc-900 placeholder:text-zinc-400 w-full"
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data?.items.map((faculty) => (
                <tr key={faculty.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">{faculty.employee_id}</td>
                  <td className="px-4 py-3 text-slate-700">{faculty.user.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{faculty.user.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="font-medium text-slate-800">
                      {departmentById.get(faculty.department_id)?.abbreviation ?? `Dept ${faculty.department_id}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      {departmentById.get(faculty.department_id)?.name ?? "Department"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{faculty.designation ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(faculty)}
                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 border border-zinc-200/80 transition-all shadow-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove.mutate(faculty.id)}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 border border-red-200/80 transition-all shadow-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(query.data?.items.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-slate-500">No faculty records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{query.data?.total ?? 0} records</span>
        <div className="flex items-center gap-2">
          <Button type="button" className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous
          </Button>
          <span className="rounded-md border border-slate-200 px-3 py-2">{page}</span>
          <Button type="button" className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" disabled={(query.data?.items.length ?? 0) < 10} onClick={() => setPage((current) => current + 1)}>
            Next
          </Button>
        </div>
      </div>

      <Modal title={editing ? "Edit Faculty" : "Add Faculty"} open={open} onClose={() => setOpen(false)}>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (editing) {
              updateForm.handleSubmit((values) => save.mutate(values))();
            } else {
              createForm.handleSubmit((values) => save.mutate(values))();
            }
          }}
        >
          {editing ? (
            <>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Full Name</span>
                <Input {...updateForm.register("full_name")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Email</span>
                <Input {...updateForm.register("email")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Password</span>
                <Input type="password" {...updateForm.register("password")} placeholder="Leave blank to keep unchanged" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Employee ID</span>
                <Input {...updateForm.register("employee_id")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Department ID</span>
                <select {...updateForm.register("department_id", { valueAsNumber: true })} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                  <option value={0}>Select department</option>
                  {departmentItems.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.abbreviation} - {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Designation</span>
                <Input {...updateForm.register("designation")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Phone</span>
                <Input {...updateForm.register("phone")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Active</span>
                <select {...updateForm.register("is_active")} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Full Name</span>
                <Input {...createForm.register("full_name")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Email</span>
                <Input {...createForm.register("email")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Password</span>
                <Input type="password" {...createForm.register("password")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Employee ID</span>
                <Input {...createForm.register("employee_id")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Department ID</span>
                <select {...createForm.register("department_id", { valueAsNumber: true })} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                  <option value={0}>Select department</option>
                  {departmentItems.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.abbreviation} - {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Designation</span>
                <Input {...createForm.register("designation")} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Phone</span>
                <Input {...createForm.register("phone")} />
              </label>
            </>
          )}
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || departments.isLoading || departmentItems.length === 0}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
        {departmentItems.length === 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Create at least one department before adding faculty.
          </p>
        )}
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
