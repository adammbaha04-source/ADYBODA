import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type FeedbackKind = "success" | "error" | "warning" | "info";
interface FeedbackItem { id: number; kind: FeedbackKind; title: string; message: string; }
export interface FeedbackApi {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const DEFAULT_TITLE: Record<FeedbackKind, string> = {
  success: "Imefanikiwa",
  error: "Kuna tatizo",
  warning: "Tahadhari",
  info: "Taarifa",
};
const ICON: Record<FeedbackKind, string> = { success: "✓", error: "✕", warning: "!", info: "i" };
// Ujumbe wa kufanikiwa hufungwa wenyewe; ujumbe wa kosa unasubiri mtumiaji abonyeze "Sawa".
const AUTO_CLOSE_MS: Partial<Record<FeedbackKind, number>> = { success: 2400, info: 4000 };

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const nextId = useRef(1);

  const close = useCallback((id: number) => {
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const push = useCallback((kind: FeedbackKind, message: string, title?: string) => {
    const id = nextId.current++;
    setItems((list) => [...list, { id, kind, message, title: title ?? DEFAULT_TITLE[kind] }]);
    const ms = AUTO_CLOSE_MS[kind];
    if (ms) window.setTimeout(() => close(id), ms);
  }, [close]);

  const api = useMemo<FeedbackApi>(() => ({
    success: (m, t) => push("success", m, t),
    error: (m, t) => push("error", m, t),
    warning: (m, t) => push("warning", m, t),
    info: (m, t) => push("info", m, t),
  }), [push]);

  const current = items[0];

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter") close(current.id); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, close]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {current && (
        <div className="fb-overlay" onClick={() => close(current.id)}>
          <div
            className={`fb-modal fb-${current.kind}`}
            role={current.kind === "error" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby={`fb-title-${current.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fb-icon" aria-hidden="true">{ICON[current.kind]}</div>
            <h4 className="fb-title" id={`fb-title-${current.id}`}>{current.title}</h4>
            <p className="fb-message">{current.message}</p>
            <button type="button" className="fb-btn" autoFocus onClick={() => close(current.id)}>Sawa</button>
            {items.length > 1 && <span className="fb-queue">+{items.length - 1} zaidi</span>}
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback lazima itumike ndani ya FeedbackProvider");
  return ctx;
}
