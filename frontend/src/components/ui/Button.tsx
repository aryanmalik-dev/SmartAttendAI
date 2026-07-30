import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-black font-semibold shadow-sm border border-transparent",
  secondary: "bg-white text-zinc-800 hover:bg-zinc-100 border border-zinc-200 font-semibold shadow-sm",
  outline: "bg-white text-zinc-800 hover:bg-zinc-100 border border-zinc-200 font-semibold shadow-sm",
  danger: "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-semibold shadow-sm",
  ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100 font-semibold"
};

export function Button({ className, variant, ...props }: ButtonProps) {
  // Infer variant if not explicitly passed but className contains light bg/text
  let resolvedVariant = variant ?? "primary";
  if (!variant && className) {
    if (className.includes("bg-white") || className.includes("bg-slate") || className.includes("bg-zinc") || className.includes("ring-1")) {
      if (className.includes("rose") || className.includes("red")) {
        resolvedVariant = "danger";
      } else {
        resolvedVariant = "secondary";
      }
    }
  }

  return (
    <button
      className={clsx(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 select-none",
        variantStyles[resolvedVariant],
        className
      )}
      {...props}
    />
  );
}

