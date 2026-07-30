import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../../lib/auth";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid institutional email"),
  password: z.string().min(1, "Password is required")
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@smartattend.ai", password: "Admin@123" }
  });

  if (user) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen w-full bg-[#f8f9fa] text-zinc-900 flex flex-col justify-between p-4 sm:p-8 lg:p-12 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-7xl w-full mx-auto border-b border-zinc-200/80 pb-4 sm:pb-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-sm">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <span className="text-sm sm:text-base font-semibold tracking-tight text-zinc-900">
            SmartAttend <span className="text-zinc-500 font-normal ml-0.5">AI</span>
          </span>
        </div>

        <div className="text-xs sm:text-xs text-zinc-500 font-medium">
          Institutional Portal
        </div>
      </header>

      {/* Main Content Area */}
      <div className="my-auto py-6 sm:py-8 lg:py-12 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-16 items-center">
        {/* Left Side (Desktop Only - 60% Width) */}
        <div className="hidden lg:block lg:col-span-7 space-y-6 pr-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-xs font-medium text-zinc-600 shadow-sm w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Biometric Vision Management
          </div>

          <h1 className="text-5xl lg:text-6xl font-light tracking-tight text-zinc-900 leading-[1.15]">
            Attendance, <br />
            <span className="italic font-serif text-zinc-700 font-normal">simplified for modern academia.</span>
          </h1>

          <p className="text-sm text-zinc-600 max-w-md leading-relaxed font-normal pt-1">
            Automated facial recognition, role-aware dashboards, and real-time classroom vision monitoring for higher education.
          </p>
        </div>

        {/* Right Side (Mobile Hero + 40% Desktop Form Card) */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto lg:max-w-none">
          {/* Mobile Header Notice */}
          <div className="lg:hidden text-center mb-6 space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-zinc-900">
              Attendance, <span className="italic font-serif text-zinc-700">simplified.</span>
            </h1>
            <p className="text-xs text-zinc-500">Sign in to access your institutional dashboard</p>
          </div>

          <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-8 md:p-10 shadow-xl shadow-zinc-200/50">
            <div className="mb-6 sm:mb-8 hidden lg:block">
              <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Sign In</h2>
              <p className="text-xs text-zinc-500 mt-1.5">Enter your institutional account credentials below.</p>
            </div>

            {errorMsg && (
              <div className="mb-5 sm:mb-6 rounded-xl border border-red-200 bg-red-50 p-3.5 sm:p-4 text-xs text-red-700 font-medium leading-relaxed">
                {errorMsg}
              </div>
            )}

            <form
              onSubmit={handleSubmit(async (values) => {
                setErrorMsg(null);
                try {
                  await signIn(values.email, values.password);
                  navigate("/");
                } catch {
                  setErrorMsg("Authentication failed. Check your email and password.");
                }
              })}
              className="space-y-4 sm:space-y-5"
            >
              <div className="space-y-1.5 sm:space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="admin@smartattend.ai"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 px-4 py-3.5 text-base sm:text-sm focus:outline-none focus:border-zinc-900 focus:bg-white transition-all placeholder:text-zinc-400"
                  {...register("email")}
                />
                {formState.errors.email && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 px-4 py-3.5 text-base sm:text-sm focus:outline-none focus:border-zinc-900 focus:bg-white transition-all placeholder:text-zinc-400 pr-11"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors p-1.5"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formState.errors.password && (
                  <p className="text-xs text-red-600 mt-1 font-medium">{formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="w-full min-h-[48px] bg-zinc-900 hover:bg-black text-white font-semibold py-3.5 px-4 text-sm sm:text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-50 mt-3"
              >
                <span>{formState.isSubmitting ? "Authenticating..." : "Sign In to Portal"}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <footer className="border-t border-zinc-200/80 pt-4 sm:pt-6 max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 font-medium gap-1.5 sm:gap-2 text-center sm:text-left">
        <div>SmartAttend AI Engine — Institutional Suite</div>
        <div>Restricted Access — Authorized Personnel Only</div>
      </footer>
    </main>
  );
}












