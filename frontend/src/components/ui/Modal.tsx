import { X } from "lucide-react";

export function Modal({
  title,
  open,
  onClose,
  children
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 sm:p-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-zinc-200/90 my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-8 w-8 place-items-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto p-6 flex-1 text-sm text-zinc-700">
          {children}
        </div>
      </div>
    </div>
  );
}

