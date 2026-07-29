import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, RotateCw, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Toast } from "../../components/ui/Toast";
import { api, listNotifications } from "../../lib/api";

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [retryEmail, setRetryEmail] = useState("");

  const query = useQuery({
    queryKey: ["notifications", search],
    queryFn: () => listNotifications({ search, p: 1, size: 20 })
  });

  const send = useMutation({
    mutationFn: async () => (await api.post("/notifications/send", { to_email: email, subject, message })).data.data,
    onSuccess: () => {
      setToast("Notification queued");
      setEmail("");
      setSubject("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const retry = useMutation({
    mutationFn: async (notificationId: number) => (await api.post(`/notifications/retry/${notificationId}`, { to_email: retryEmail || undefined })).data.data,
    onSuccess: () => {
      setToast("Retry requested");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Notifications</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Notification History</h2>
          <p className="mt-1 text-sm text-slate-500">Track outgoing notifications and retry failed sends.</p>
        </div>
        <div className="w-full max-w-sm">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notification history" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <div className="flex items-center gap-2 text-slate-900">
            <Bell size={18} className="text-brand-700" />
            <h3 className="text-base font-semibold">Recent Notifications</h3>
          </div>
          <div className="mt-4 space-y-3">
            {query.data?.items.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-950">{item.subject}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.recipient_email ?? "system"} · {item.channel}</p>
                    <p className="mt-2 text-sm text-slate-600">{item.message}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{item.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                  <span>Sent: {item.sent_at ? new Date(item.sent_at).toLocaleString() : "pending"}</span>
                </div>
                {item.status === "failed" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => retry.mutate(item.id)}
                      className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                    >
                      <RotateCw size={16} />
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {(query.data?.items.length ?? 0) === 0 && <p className="text-sm text-slate-500">No notifications found.</p>}
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-950">Send Notification</h3>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Recipient Email</span>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="faculty@school.edu" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Subject</span>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Attendance update" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Message</span>
              <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Your message" />
            </label>
            <Button type="button" onClick={() => send.mutate()} disabled={send.isPending || !email || !subject || !message}>
              <Send size={16} />
              Send
            </Button>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-4">
            <h4 className="text-sm font-semibold text-slate-900">Retry email override</h4>
            <p className="mt-1 text-sm text-slate-500">Optional address to use while retrying a failed notification.</p>
            <Input value={retryEmail} onChange={(event) => setRetryEmail(event.target.value)} placeholder="override@school.edu" className="mt-3" />
          </div>
        </Card>
      </div>

      <Toast message={toast} />
    </div>
  );
}
