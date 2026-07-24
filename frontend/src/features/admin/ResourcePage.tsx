import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { api, listResource } from "../../lib/api";

type Props = { title: string; path: string; fields: string[] };

export function ResourcePage({ title, path, fields }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: [path, search, page], queryFn: () => listResource<Record<string, unknown>>(path, search, page) });
  const mutation = useMutation({
    mutationFn: async () => api.post(path, normalize(form)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [path] }); setOpen(false); setForm({}); }
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-bold">{title}</h2><p className="text-sm text-slate-500">Search, filter, paginate, and manage records.</p></div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Add {title.slice(0, -1)}</Button>
      </div>
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Search size={18} className="text-slate-400" />
          <Input placeholder={`Search ${title.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        {isLoading ? <p className="text-sm text-slate-500">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{fields.map((field) => <th className="px-3 py-3" key={field}>{field.replaceAll("_", " ")}</th>)}</tr></thead>
              <tbody>{data?.items.map((row, index) => <tr className="border-t border-slate-100" key={String(row.id ?? index)}>{fields.map((field) => <td className="px-3 py-3 text-slate-700" key={field}>{String(row[field] ?? "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{data?.total ?? 0} records</span>
          <div className="flex gap-2"><Button className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" onClick={() => setPage(page + 1)}>Next</Button></div>
        </div>
      </Card>
      <Modal title={`Add ${title.slice(0, -1)}`} open={open} onClose={() => setOpen(false)}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          {fields.map((field) => <label key={field} className="text-sm font-semibold text-slate-700">{field.replaceAll("_", " ")}<Input className="mt-2" value={form[field] ?? ""} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></label>)}
          <Button className="sm:col-span-2" disabled={mutation.isPending}>Save</Button>
        </form>
      </Modal>
    </div>
  );
}

function normalize(form: Record<string, string>) {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => {
    if (["capacity", "credits", "department_id", "faculty_id", "classroom_id", "course_id"].includes(key)) return [key, Number(value)];
    if (key === "is_active") return [key, value !== "false"];
    return [key, value];
  }));
}
