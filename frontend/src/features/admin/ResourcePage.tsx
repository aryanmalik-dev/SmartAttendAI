import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Plus, Search, Upload, PencilLine, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { api, downloadFromResponse, exportResource, listResource } from "../../lib/api";
import { useAuth } from "../../lib/auth";

type FieldType = "text" | "number" | "boolean" | "date";

type FilterField = {
  key: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
};

type RelationField = {
  field: string;
  path: string;
  labelText?: string;
  label: (item: Record<string, any>) => string;
};

type ResourcePageProps = {
  title: string;
  path: string;
  fields: string[];
  fieldTypes?: Record<string, FieldType>;
  relations?: RelationField[];
  itemName?: string;
  filters?: FilterField[];
  importable?: boolean;
  exportable?: boolean;
  templateable?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  defaultSort?: string;
};

function titleize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeFieldValue(key: string, value: string, fieldTypes: Record<string, FieldType>) {
  const type = fieldTypes[key] ?? (key.endsWith("_id") || key === "capacity" || key === "credits" || key === "duration_years" || key === "semester" ? "number" : "text");
  if (type === "number") return value === "" ? null : Number(value);
  if (type === "boolean") return value === "true";
  return value;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ResourcePage({
  title,
  path,
  fields,
  fieldTypes = {},
  relations = [],
  itemName,
  filters = [],
  importable = false,
  exportable = false,
  templateable = false,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  defaultSort = ""
}: ResourcePageProps) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.roles.includes("admin"));

  const allowCreate = canCreate && isAdmin;
  const allowEdit = canEdit && isAdmin;
  const allowDelete = canDelete && isAdmin;

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const relationQueries = useQueries({
    queries: relations.map((relation) => ({
      queryKey: [relation.path, "resource-select"],
      queryFn: () => listResource<Record<string, unknown>>(relation.path, { p: 1, size: 100 })
    }))
  });

  const relationMap = useMemo(() => {
    const map = new Map<string, { options: Record<string, any>[]; label: (item: Record<string, any>) => string }>();
    relations.forEach((relation, index) => {
      const query = relationQueries[index];
      map.set(relation.field, {
        options: (query.data?.items ?? []) as Record<string, any>[],
        label: relation.label
      });
    });
    return map;
  }, [relationQueries, relations]);

  const params = useMemo(() => {
    const next: Record<string, string | number | boolean | null | undefined> = { p: page, size: 10 };
    if (search.trim()) next.search = search.trim();
    if (sort.trim()) next.sort = sort.trim();
    for (const filter of filters) {
      const value = filterValues[filter.key];
      if (value !== undefined && value !== "") next[filter.key] = filter.type === "number" ? Number(value) : value;
    }
    return next;
  }, [filters, filterValues, page, search, sort]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [path, params],
    queryFn: () => listResource<Record<string, unknown>>(path, params)
  });

  const mutate = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing?.id) {
        const { data } = await api.patch(`${path}/${editing.id}`, payload);
        return data;
      }
      const { data } = await api.post(path, payload);
      return data;
    },
    onSuccess: (response: unknown) => {
      queryClient.invalidateQueries({ queryKey: [path] });
      relations.forEach((relation) => {
        queryClient.invalidateQueries({ queryKey: [relation.path] });
      });
      setToast((response as { message?: string } | undefined)?.message ?? `${itemName ?? title.slice(0, -1)} saved`);
      setOpen(false);
      setEditing(null);
      setForm({});
    }
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`${path}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [path] });
      relations.forEach((relation) => {
        queryClient.invalidateQueries({ queryKey: [relation.path] });
      });
      setToast(`${itemName ?? title.slice(0, -1)} deleted`);
    }
  });

  async function handleImport(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    await api.post(`${path}/import`, formData, { headers: { "Content-Type": "multipart/form-data" } });
    queryClient.invalidateQueries({ queryKey: [path] });
    relations.forEach((relation) => {
      queryClient.invalidateQueries({ queryKey: [relation.path] });
    });
    setToast("Import completed");
  }

  async function handleExport(format: "csv" | "xlsx") {
    try {
      const blob = await exportResource(`${path}/export`, { ...params, file_format: format });
      downloadFromResponse(blob, `${path.replaceAll("/", "").replace("-", "_")}.${format}`);
      setToast(`${title} export started`);
    } catch {
      setToast(`${title} export failed`);
    }
  }

  async function handleTemplate(format: "csv" | "xlsx") {
    try {
      const blob = await exportResource(`${path}/template`, { file_format: format });
      downloadFromResponse(blob, `${path.replaceAll("/", "").replace("-", "_")}_template.${format}`);
      setToast(`${title} template download started`);
    } catch {
      setToast(`${title} template download failed`);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(Object.fromEntries(fields.map((field) => [field, ""])));
    setOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditing(row);
    setForm(Object.fromEntries(fields.map((field) => [field, row[field] === null || row[field] === undefined ? "" : String(row[field])])));
    setOpen(true);
  }

  function submitForm() {
    const payload = Object.fromEntries(fields.map((field) => [field, normalizeFieldValue(field, form[field] ?? "", fieldTypes)]));
    mutate.mutate(payload);
  }

  function displayValue(field: string, value: unknown) {
    const relation = relationMap.get(field);
    if (relation && typeof value === "number") {
      const option = relation.options.find((item) => Number(item.id) === value);
      if (option) return relation.label(option);
    }
    return formatCell(value);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Master data</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">Manage records with search, filters, export, and template downloads.</p>
        </div>
        {allowCreate && (
          <Button type="button" onClick={openCreate}>
            <Plus size={16} />
            Add {itemName ?? title.slice(0, -1)}
          </Button>
        )}
      </div>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
          <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3">
            <Search size={18} className="text-slate-400" />
            <Input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder={`Search ${title.toLowerCase()}`}
              className="border-0 px-0 focus:ring-0"
            />
          </div>
          <Input
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            placeholder="Sort"
          />
        </div>

        {filters.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filters.map((filter) => (
              <label key={filter.key} className="text-sm font-medium text-slate-700">
                <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">{filter.label}</span>
                <Input
                  value={filterValues[filter.key] ?? ""}
                  onChange={(event) => {
                    setPage(1);
                    setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }));
                  }}
                  placeholder={filter.placeholder ?? filter.label}
                  type={filter.type === "number" ? "number" : filter.type === "date" ? "date" : "text"}
                />
              </label>
            ))}
          </div>
        )}

        {(importable || exportable || templateable) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {importable && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Upload size={16} />
                Import
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      try {
                        await handleImport(file);
                      } catch {
                        setToast("Import failed");
                      }
                    }
                    event.target.value = "";
                  }}
                />
              </label>
            )}
            {exportable && (
              <>
                <button type="button" onClick={() => handleExport("csv")} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 shadow-sm transition-all">
                  <Download size={15} />
                  CSV
                </button>
                <button type="button" onClick={() => handleExport("xlsx")} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 shadow-sm transition-all">
                  <FileSpreadsheet size={15} />
                  Excel
                </button>
              </>
            )}
            {templateable && (
              <>
                <button type="button" onClick={() => void handleTemplate("csv")} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 shadow-sm transition-all">
                  <FileText size={15} />
                  Template CSV
                </button>
                <button type="button" onClick={() => void handleTemplate("xlsx")} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 shadow-sm transition-all">
                  <FileSpreadsheet size={15} />
                  Template Excel
                </button>
              </>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {fields.map((field) => (
                  <th key={field} className="px-4 py-3 font-medium">
                    {titleize(field)}
                  </th>
                ))}
                {(allowEdit || allowDelete) && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={fields.length + 1}>Loading...</td>
                </tr>
              ) : data?.items?.length ? (
                data.items.map((row, index) => (
                  <tr key={String(row.id ?? index)} className="hover:bg-slate-50/70">
                    {fields.map((field) => (
                      <td key={field} className="max-w-[320px] px-4 py-3 align-top text-slate-700">
                        <div className="truncate">{displayValue(field, row[field])}</div>
                      </td>
                    ))}
                    {(allowEdit || allowDelete) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {allowEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 border border-zinc-200/80 transition-all shadow-sm"
                            >
                              <PencilLine size={14} />
                              Edit
                            </button>
                          )}
                          {allowDelete && (
                            <button
                              type="button"
                              onClick={() => remove.mutate(Number(row.id))}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 border border-red-200/80 transition-all shadow-sm disabled:opacity-50"
                              disabled={remove.isPending}
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={fields.length + 1}>No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-600">
          <span>
            {data?.total ?? 0} total records {isFetching ? " · refreshing" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Previous
            </Button>
            <span className="rounded-md border border-slate-200 px-3 py-2">{page}</span>
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              disabled={!data || data.items.length < 10}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Modal title={`${editing ? "Edit" : "Add"} ${itemName ?? title.slice(0, -1)}`} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const relation = relationMap.get(field);
              const type = relation ? "select" : fieldTypes[field] ?? (field.endsWith("_id") || field === "capacity" || field === "credits" || field === "duration_years" || field === "semester" ? "number" : "text");
              const relationQuery = relations.find((item) => item.field === field);
              const options = relation ? relation.options : [];
              const label = relation ? relationQuery?.labelText ?? titleize(field.replace(/_id$/, "")) : titleize(field);
              return (
                <label key={field} className="text-sm font-medium text-slate-700">
                  <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">{label}</span>
                  {type === "boolean" ? (
                    <select
                      value={form[field] ?? "false"}
                      onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : type === "select" ? (
                    <select
                      value={form[field] ?? ""}
                      onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      disabled={!options.length}
                    >
                      <option value="">{relationQuery ? `Select ${label}` : "Loading..."}</option>
                      {options.map((item) => (
                        <option key={String(item.id)} value={String(item.id)}>
                          {relation?.label(item)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={form[field] ?? ""}
                      onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                    />
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitForm} disabled={mutate.isPending || relationQueries.some((query) => query.isLoading)}>
              {mutate.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
