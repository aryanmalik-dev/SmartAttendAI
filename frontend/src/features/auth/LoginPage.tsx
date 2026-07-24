import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Toast } from "../../components/ui/Toast";
import { useAuth } from "../../lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@smartattend.edu", password: "Admin@12345" }
  });
  if (user) return <Navigate to="/" replace />;
  return (
    <main className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-[1fr_520px]">
      <section className="hidden bg-brand-700 px-16 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white font-bold text-brand-700">SA</span>
          <span className="text-xl font-bold">SmartAttend AI</span>
        </div>
        <div className="max-w-2xl">
          <h1 className="text-5xl font-bold leading-tight">Intelligent attendance and classroom monitoring for modern universities.</h1>
          <p className="mt-5 text-lg leading-8 text-blue-100">Replace manual registers with InsightFace-powered recognition, live monitoring, analytics, reports, and role-aware attendance workflows.</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {["ArcFace embeddings", "JWT + RBAC", "PDF and CSV reports"].map((item) => <div key={item} className="rounded-lg border border-white/20 bg-white/10 p-4">{item}</div>)}
        </div>
      </section>
      <section className="grid place-items-center px-5">
        <form className="w-full max-w-sm" onSubmit={handleSubmit(async (values) => {
          try {
            await signIn(values.email, values.password);
            navigate("/");
          } catch {
            setToast("Invalid email or password");
          }
        })}>
          <div className="mb-8">
            <ShieldCheck className="mb-4 text-brand-600" size={42} />
            <h2 className="text-3xl font-bold text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm text-slate-500">Use your university attendance account.</p>
          </div>
          <label className="mb-4 block text-sm font-semibold text-slate-700">Email<Input className="mt-2" {...register("email")} /></label>
          <label className="mb-6 block text-sm font-semibold text-slate-700">Password<Input className="mt-2" type="password" {...register("password")} /></label>
          <Button className="w-full" disabled={formState.isSubmitting}>Sign in</Button>
          <p className="mt-4 text-xs text-slate-500">Seed users: admin@smartattend.edu, faculty@smartattend.edu, student@smartattend.edu</p>
        </form>
      </section>
      <Toast message={toast} />
    </main>
  );
}
