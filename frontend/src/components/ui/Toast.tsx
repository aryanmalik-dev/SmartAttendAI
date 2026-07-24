export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="fixed bottom-5 right-5 z-50 rounded-md bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl">{message}</div>;
}
