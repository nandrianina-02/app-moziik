"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

const ToastContext = createContext<{
  pushToast: (kind: ToastKind, message: string) => void;
}>({ pushToast: () => {} });

const icons: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const accentByKind: Record<ToastKind, string> = {
  success: "text-verified",
  error: "text-accent",
  info: "text-ink-muted",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((kind: ToastKind, message: string) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((toast) => {
          const Icon = icons[toast.kind];
          return (
            <div
              key={toast.id}
              role="status"
              className="flex items-start gap-3 rounded-xl2 border border-border bg-surface px-4 py-3 shadow-lg animate-toast-in"
            >
              <Icon size={18} className={`${accentByKind[toast.kind]} shrink-0 mt-0.5`} />
              <p className="text-sm flex-1">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer la notification"
                className="text-ink-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext).pushToast;
