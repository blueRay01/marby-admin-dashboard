import { useEffect, useState } from "react";
import { Icon, Pill } from "./ui.jsx";

const MAIN = [
  { id: "dashboard", label: "Dashboard" },
  { id: "transactions", label: "Transactions" },
  { id: "stock", label: "Stock and refills" },
];
const MORE = [
  { id: "cashbox", label: "Cash box" },
  { id: "gcash", label: "GCash float" },
  { id: "kept", label: "Kept money" },
  { id: "alerts", label: "Alerts" },
];
const ADMIN = [
  { id: "settings", label: "Settings" },
  { id: "users", label: "Users and roles" },
  { id: "audit", label: "Audit log" },
];

function Nav({ page, go, badges, user }) {
  const item = (n) => (
    <button key={n.id} className={`nav-item ${page === n.id ? "on" : ""}`} onClick={() => go(n.id)}>
      {n.label}
      {badges[n.id] ? <Pill tone={badges[n.id].tone}>{badges[n.id].text}</Pill>
        : page === n.id ? <span aria-hidden>{Icon.chevron}</span> : null}
    </button>
  );
  return (
    <nav className="nav" aria-label="Main">
      {MAIN.map(item)}
      <div className="nav-section">More</div>
      {MORE.map(item)}
      {user?.role === "Admin" && (<><div className="nav-section">Admin only</div>{ADMIN.map(item)}</>)}
    </nav>
  );
}

export default function Shell({ page, go, user, badges, onSignOut, children }) {
  const [open, setOpen] = useState(false);
  const count = Object.keys(badges).length;
  const navigate = (id) => { setOpen(false); go(id); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const brand = <div className="brand"><div className="coin">20</div>D' MARBY Admin</div>;

  return (
    <div className="app">
      <aside className="sidebar">
        {brand}
        <Nav page={page} go={navigate} badges={badges} user={user} />
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={onSignOut}>Sign out</button>
        <div className="footer">Signed in as {user.name}</div>
      </aside>

      <main className="main">
        <div className="topbar">
          {brand}
          <button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}
                  style={{ color: "var(--blue)" }}>
            {Icon.menu}
            {count > 0 && <span className="badge">{count}</span>}
          </button>
        </div>
        {children}
        <div className="footer">Machine 01, signed in as {user.name}</div>
      </main>

      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="topbar">
              {brand}
              <button className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}
                      style={{ color: "var(--blue)" }}>{Icon.close}</button>
            </div>
            <Nav page={page} go={navigate} badges={badges} user={user} />
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={onSignOut}>Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}
