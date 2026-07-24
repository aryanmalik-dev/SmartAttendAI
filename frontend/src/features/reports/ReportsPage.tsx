import { Download, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Toast } from "../../components/ui/Toast";
import { api } from "../../lib/api";

export function ReportsPage() {
  const [sessionId, setSessionId] = useState("1");
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  async function download(type: "pdf" | "csv") {
    const response = await api.get(`/reports/export/${type}`, { params: { session_id: sessionId }, responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attendance.${type}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function send() {
    await api.post("/notifications/send-summary", null, { params: { to_email: email } });
    setToast("Email notification processed");
  }
  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold">Reports</h2><p className="text-sm text-slate-500">Generate daily, weekly, monthly, student, and course attendance exports.</p></div>
      <Card className="grid gap-4 md:grid-cols-[1fr_auto_auto]"><Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="Session ID" /><Button onClick={() => download("pdf")}><Download size={16} /> PDF</Button><Button onClick={() => download("csv")}><Download size={16} /> CSV</Button></Card>
      <Card className="grid gap-4 md:grid-cols-[1fr_auto]"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="recipient@university.edu" /><Button onClick={send}><Mail size={16} /> Email Summary</Button></Card>
      <Toast message={toast} />
    </div>
  );
}
