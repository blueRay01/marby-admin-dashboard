import { useCallback, useEffect, useState } from "react";
import { COINS, currentUser, getOverview, signOut, watchSignOut } from "./api.js";
import Shell from "./components/Shell.jsx";
import SignIn from "./pages/SignIn.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Transactions from "./pages/Transactions.jsx";
import Stock from "./pages/Stock.jsx";
import { Alerts, AuditLog, CashBox, GcashRequests, Incidents, Settings, Users } from "./pages/More.jsx";

const PAGES = {
  dashboard: Dashboard, transactions: Transactions, stock: Stock, cashbox: CashBox,
  gcash: GcashRequests, incidents: Incidents, alerts: Alerts, settings: Settings, users: Users, audit: AuditLog,
};
const ADMIN_ONLY = ["settings", "users", "audit"];

// Pages live in the URL hash (#/stock), so the phone's back button works.
const readHash = () => window.location.hash.replace(/^#\/?/, "") || "dashboard";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking for a saved login
  const [page, setPage] = useState(readHash);
  const [badges, setBadges] = useState({});
  const [loadError, setLoadError] = useState("");

  // Any failed request (offline, expired login) shows a message instead of an endless skeleton.
  useEffect(() => {
    const onFail = (e) => setLoadError(e.reason?.message || "Something went wrong loading data.");
    window.addEventListener("unhandledrejection", onFail);
    return () => window.removeEventListener("unhandledrejection", onFail);
  }, []);
  useEffect(() => { setLoadError(""); }, [page]);

  useEffect(() => {
    currentUser().then(setUser);
    return watchSignOut(() => setUser(null));
  }, []);

  useEffect(() => {
    const onHash = () => setPage(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((id) => {
    window.location.hash = `/${id}`;
    window.scrollTo(0, 0);
  }, []);

  const refreshBadges = useCallback(() => {
    getOverview().catch(() => null).then((d) => {
      if (!d) return;
      const next = {};
      const empty = COINS.filter((c) => d.stock[c].count === 0);
      if (empty.length) next.stock = { tone: "red", text: `₱${empty[0]} empty` };
      if (d.gcashPending) next.gcash = { tone: "amber", text: `${d.gcashPending} to send` };
      if (d.incidentsOpen) next.incidents = { tone: "red", text: `${d.incidentsOpen} open` };
      setBadges(next);
    });
  }, []);

  useEffect(() => { if (user) refreshBadges(); }, [user, page, refreshBadges]);

  if (user === undefined) return <div className="signin"><div className="coin big">20</div></div>;

  if (!user) {
    return <SignIn onSignedIn={(u) => { setUser(u); go("dashboard"); }} />;
  }

  const allowed = PAGES[page] && (!ADMIN_ONLY.includes(page) || user.role === "Admin");
  const Page = allowed ? PAGES[page] : Dashboard;

  return (
    <Shell page={allowed ? page : "dashboard"} go={go} user={user} badges={badges}
           onSignOut={() => { signOut().finally(() => setUser(null)); }}>
      {loadError && (
        <button className="note red" style={{ width: "100%", textAlign: "left", marginTop: 12 }}
                onClick={() => window.location.reload()}>
          <span>{loadError}</span><span className="link">Reload</span>
        </button>
      )}
      <Page key={page} user={user} go={go} onChange={refreshBadges} />
    </Shell>
  );
}
