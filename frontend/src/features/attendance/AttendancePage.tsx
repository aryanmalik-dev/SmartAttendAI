import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Toast } from "../../components/ui/Toast";
import { api, listResource } from "../../lib/api";

export function AttendancePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sessionId, setSessionId] = useState("1");
  const [toast, setToast] = useState<string | null>(null);
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => listResource<Record<string, unknown>>("/attendance/sessions") });
  const recognize = useMutation({
    mutationFn: async (image_base64: string) => (await api.post(`/attendance/sessions/${sessionId}/recognize`, { image_base64 })).data.data,
    onSuccess: (data) => setToast(`Marked ${data.marked.length} student(s), ${data.unknown_faces} unknown face(s)`)
  });
  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) videoRef.current.srcObject = stream;
  }
  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    recognize.mutate(canvas.toDataURL("image/jpeg", 0.9));
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div><h2 className="text-2xl font-bold">Webcam Attendance</h2><p className="text-sm text-slate-500">Detect faces, match ArcFace embeddings, and prevent duplicate marks.</p></div>
          <div className="w-32"><Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} aria-label="Session ID" /></div>
        </div>
        <video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-lg bg-slate-900 object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="mt-4 flex flex-wrap gap-3"><Button onClick={startCamera}><Camera size={16} /> Start Webcam</Button><Button onClick={capture} disabled={recognize.isPending}><CheckCircle2 size={16} /> Mark Attendance</Button></div>
      </Card>
      <Card>
        <h3 className="mb-4 text-lg font-semibold">Attendance Sessions</h3>
        <div className="space-y-3">{sessions.data?.items.map((session) => <button key={String(session.id)} onClick={() => setSessionId(String(session.id))} className="w-full rounded-md border border-slate-200 p-3 text-left text-sm hover:border-brand-200 hover:bg-brand-50"><span className="font-semibold">Session #{String(session.id)}</span><span className="ml-2 text-slate-500">{String(session.session_date)}</span></button>)}</div>
      </Card>
      <Toast message={toast} />
    </div>
  );
}
