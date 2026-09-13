"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type Tone = "neutral" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
};

type Show = (
  message: string,
  options?: { tone?: Tone; action?: Toast["action"]; duration?: number },
) => void;

const ToastContext = createContext<Show>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<Show>(
    (message, options = {}) => {
      const id = nextId.current++;
      const toast: Toast = {
        id,
        message,
        tone: options.tone ?? "neutral",
        action: options.action,
      };
      setToasts((list) => [...list.slice(-2), toast]);
      setTimeout(() => dismiss(id), options.duration ?? 2800);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Polite so it is announced without stealing focus from the grid. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full py-2.5 pl-4 pr-2 text-[14px] shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            style={{
              animation: "pop-in 0.24s cubic-bezier(0.22,0.61,0.36,1) both",
              background: "var(--bg-elevated)",
              border: `1px solid ${
                t.tone === "error"
                  ? "color-mix(in srgb, var(--danger) 45%, transparent)"
                  : "var(--separator)"
              }`,
              color: t.tone === "error" ? "var(--danger)" : "var(--fg)",
            }}
          >
            <span className="truncate pr-1">{t.message}</span>
            {t.action ? (
              <button
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-full px-3 py-1 text-[14px] font-medium"
                style={{ color: "var(--accent)", background: "var(--bg-tertiary)" }}
              >
                {t.action.label}
              </button>
            ) : (
              <span className="w-1" />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
