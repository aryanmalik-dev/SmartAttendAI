import { useEffect, useState } from "react";

export function Toast({ message }: { message: string | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message || !visible) return null;
  return <div className="fixed bottom-5 right-5 z-50 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-xl">{message}</div>;
}
