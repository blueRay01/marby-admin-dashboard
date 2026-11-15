import { useEffect } from "react";

export const peso = (n) => `₱${Number(n).toLocaleString()}`;

export const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

export const dateOf = (iso) =>
  new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

export function Pill({ tone = "blue", dot = false, children }) {
  return (
    <span className={`pill ${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function Bar({ value, tone }) {
  return (
    <div className={`bar ${tone || ""}`} role="progressbar" aria-valuenow={Math.round(value * 100)}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/** Bottom sheet on phones, centered dialog on desktop. */
export function Sheet({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const STATUS = {
  good: { tone: "blue", label: "Good" },
  low: { tone: "amber", label: "Low" },
  empty: { tone: "red", label: "Empty" },
};

// Small line icons, drawn inline so there are no icon dependencies.
const svg = (d) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
export const Icon = {
  bill: svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>),
  gcash: svg(<><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10 18h4" /></>),
  combine: svg(<><circle cx="8" cy="9" r="4" /><circle cx="16" cy="15" r="5" /></>),
  break: svg(<><circle cx="12" cy="12" r="8" /><path d="M8 12h8" /></>),
  refund: svg(<><path d="M9 14l-4-4 4-4" /><path d="M5 10h9a5 5 0 0 1 0 10h-3" /></>),
  incident: svg(<><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>),
  check: svg(<path d="M5 12l5 5 9-10" />),
  copy: svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>),
  menu: svg(<><path d="M5 7h14M5 12h14M5 17h14" /></>),
  close: svg(<><path d="M6 6l12 12M18 6L6 18" /></>),
  chevron: svg(<path d="M9 6l6 6-6 6" />),
  lock: svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
};
