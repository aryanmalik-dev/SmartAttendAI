import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Toast } from "../../components/ui/Toast";
import { api, downloadFromResponse, exportResource } from "../../lib/api";

type ReportKind =
  | "records"
  | "students"
  | "faculty"
  | "departments"
  | "courses"
  | "subjects"
  | "daily"
  | "weekly"
  | "monthly"
  | "semester"
  | "low-attendance"
  | "top-attendance"
  | "missing-attendance";

type ReportResponse = {
  items?: Record<string, unknown>[];
  total?: number;
  page?: number;
  size?: number;
  [key: string]: unknown;
};

const reportKinds: { kind: ReportKind; label: string; endpoint: string }[] = [
  { kind: "records", label: "Records", endpoint: "/reports/records" },
  { kind: "students", label: "Student Summary", endpoint: "/reports/students" },
  { kind: "faculty", label: "Faculty Summary", endpoint: "/reports/faculty" },
  { kind: "departments", label: "Department Summary", endpoint: "/reports/departments" },
  { kind: "courses", label: "Course Summary", endpoint: "/reports/courses" },
  { kind: "subjects", label: "Subject Summary", endpoint: "/reports/subjects" },
  { kind: "daily", label: "Daily", endpoint: "/reports/daily" },
  { kind: "weekly", label: "Weekly", endpoint: "/reports/weekly" },
  { kind: "monthly", label: "Monthly", endpoint: "/reports/monthly" },
  { kind: "semester", label: "Semester", endpoint: "/reports/semester" },
  { kind: "low-attendance", label: "Low Attendance", endpoint: "/reports/low-attendance" },
  { kind: "top-attendance", label: "Top Attendance", endpoint: "/reports/top-attendance" },
  { kind: "missing-attendance", label: "Missing Attendance", endpoint: "/reports/missing-attendance" }
];

function titleize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function isPageResponse(value: ReportResponse) {
  return Array.isArray(value.items);
}

export function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>("records");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [semesterNo, setSemesterNo] = useState("");
  const [section, setSection] = useState("");
  const [batch, setBatch] = useState("");
  const [status, setStatus] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [toast, setToast] = useState<string | null>(null);

  const selected = reportKinds.find((item) => item.kind === kind) ?? reportKinds[0];

  const params = useMemo(() => {
    const next: Record<string, string | number> = { page, size };
    if (search) next.search = search;
    if (departmentId) next.department_id = Number(departmentId);
    if (courseId) next.course_id = Number(courseId);
    if (subjectId) next.subject_id = Number(subjectId);
    if (facultyId) next.faculty_id = Number(facultyId);
    if (semesterNo) next.semester = Number(semesterNo);
    if (section) next.section = section;
    if (batch) next.batch = batch;
    if (status) next.status = status;
    if (reportDate) next.report_date = reportDate;
    if (kind === "semester" && semesterNo) next.semester_no = Number(semesterNo);
    return next;
  }, [batch, courseId, departmentId, facultyId, kind, page, reportDate, search, section, semesterNo, size, status, subjectId]);

  const query = useQuery({
    queryKey: ["reports", kind, params],
    queryFn: async () => (await api.get(`/reports/${kind}`, { params })).data.data as ReportResponse
  });

  async function handleExport() {
    try {
      const blob = await exportResource(`/reports/export/${kind}`, { ...params, file_format: format });
      downloadFromResponse(blob, `${kind}.${format}`);
      setToast("Report export started");
    } catch {
      setToast("Report export failed");
    }
  }

  const data = query.data;
  const rows = data && isPageResponse(data) ? data.items : null;
  const columns = rows && rows.length > 0 ? Array.from(new Set(rows.flatMap((row) => Object.keys(row)))) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Reports</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Attendance Reports</h2>
          <p className="mt-1 text-sm text-slate-500">Generate, filter, and export daily, weekly, monthly, and entity reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={format} onChange={(event) => setFormat(event.target.value as "csv" | "xlsx")} className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
          </select>
          <Button type="button" onClick={() => void handleExport()}>
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2">
          {reportKinds.map((item) => (
            <button
              key={item.kind}
              type="button"
              onClick={() => {
                setKind(item.kind);
                setPage(1);
              }}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                kind === item.kind ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Search</span>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
              <Search size={16} className="text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="border-0 px-0 focus:ring-0" />
            </div>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Department ID</span>
            <Input value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} placeholder="Optional" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Course ID</span>
            <Input value={courseId} onChange={(event) => setCourseId(event.target.value)} placeholder="Optional" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Faculty ID</span>
            <Input value={facultyId} onChange={(event) => setFacultyId(event.target.value)} placeholder="Optional" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Subject ID</span>
            <Input value={subjectId} onChange={(event) => setSubjectId(event.target.value)} placeholder="Optional" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Semester</span>
            <Input value={semesterNo} onChange={(event) => setSemesterNo(event.target.value)} placeholder="Optional" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Section</span>
            <Input value={section} onChange={(event) => setSection(event.target.value)} placeholder="Optional" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Batch</span>
            <Input value={batch} onChange={(event) => setBatch(event.target.value)} placeholder="Optional" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Date</span>
            <Input value={reportDate} onChange={(event) => setReportDate(event.target.value)} type="date" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Page Size</span>
            <Input value={String(size)} onChange={(event) => setSize(Number(event.target.value) || 20)} type="number" min={1} max={100} />
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {rows ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3 font-medium">
                      {titleize(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50/60">
                    {columns.map((column) => (
                      <td key={column} className="px-4 py-3 text-slate-700">
                        {String(row[column] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(data ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-md border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{titleize(key)}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{Array.isArray(value) ? value.length : String(value)}</p>
              </div>
            ))}
            {!data && <p className="text-sm text-slate-500">Choose a report to load data.</p>}
          </div>
        )}

        {rows && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-4 text-sm text-slate-600">
            <span>
              {data?.total ?? rows.length} records
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </Button>
              <span className="rounded-md border border-slate-200 px-3 py-2">{page}</span>
              <Button type="button" className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" disabled={rows.length < size} onClick={() => setPage((current) => current + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-400">Export kind</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{selected.label}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-400">Current format</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{format.toUpperCase()}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-400">Quick actions</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleExport()} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
              <FileText size={16} />
              Export
            </Button>
            <Button type="button" onClick={() => setToast("Filters ready")} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
              <Filter size={16} />
              Filters
            </Button>
            <Button type="button" onClick={() => setFormat(format === "csv" ? "xlsx" : "csv")} className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
              <FileSpreadsheet size={16} />
              Toggle
            </Button>
          </div>
        </Card>
      </div>

      <Toast message={toast} />
    </div>
  );
}
