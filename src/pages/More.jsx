import { useEffect, useState } from "react";
import {
  COINS, coinStatus, getGcashFloat, getOverview, getSettings, getStock, getTransactions, getUsers,
  markKeptReviewed, saveSettings, topUpFloat,
} from "../api.js";
import { Bar, Pill, Sheet, dateOf, peso, timeOf } from "../components/ui.jsx";
import { TxRow } from "./Transactions.jsx";

const Title = ({ children, sub }) => (
  <><h1 className="page-title">{children}</h1>{sub && <p className="page-sub">{sub}</p>}</>
);

export function CashBox() {
  const [data, setData] = useState(null);
  useEffect(() => { getStock().then(setData); }, []);
  if (!data) return <><Title>Cash box</Title><div className="skeleton" /></>;
  const { cashBox, activity } = data;
  return (
    <>
      <Title sub={`Money taken in since ${dateOf(cashBox.since)}, ${timeOf(cashBox.since)}`}>Cash box</Title>
      <div className="card">
        <div className="label">In the box now</div>
        <div className="big-num">{peso(cashBox.bills + cashBox.coins)}</div>
        <div className="row" style={{ marginTop: 12 }}><span className="label">Bills</span><b>{peso(cashBox.bills)}</b></div>
        <div className="row" style={{ marginTop: 8 }}><span className="label">Coins taken in</span><b>{peso(cashBox.coins)}</b></div>
      </div>
      <div className="card">
        <h3>Past collections</h3>
        {activity.filter((a) => a.kind === "cash").map((a) => (
          <div className="tx" key={a.id}><div><div className="tx-title">{a.text}</div>
            <div className="tx-meta">{a.who}, {dateOf(a.time)}, {timeOf(a.time)}</div></div></div>
        ))}
      </div>
    </>
  );
}

export function GcashFloat() {
  const [f, setF] = useState(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const load = () => getGcashFloat().then(setF);
  useEffect(() => { load(); }, []);
  if (!f) return <><Title>GCash float</Title><div className="skeleton" /></>;
  const share = f.balance / f.target;
  return (
    <>
      <Title sub="Money available for customer cash-ins">GCash float</Title>
      <div className="card">
        <div className="row"><div><div className="label">Balance</div><div className="big-num">{peso(f.balance)}</div></div>
          <Pill tone={share < 0.2 ? "amber" : "blue"}>{share < 0.2 ? "Top up soon" : "Enough for today"}</Pill></div>
        <Bar value={share} tone={share < 0.2 ? "amber" : ""} />
        <div className="muted small" style={{ marginTop: 8 }}>Target {peso(f.target)}</div>
      </div>
      <button className="btn white" onClick={() => setOpen(true)}>Record top-up</button>
      {open && (
        <Sheet title="Record top-up" onClose={() => setOpen(false)}>
          <label className="field"><span>Amount added to the float</span>
            <input className="input" inputMode="numeric" autoFocus value={amount}
                   onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 1000" />
          </label>
          <button className="btn primary" disabled={!Number(amount)}
                  onClick={() => topUpFloat(Number(amount)).then(() => { setOpen(false); setAmount(""); load(); })}>
            Save top-up
          </button>
        </Sheet>
      )}
    </>
  );
}

export function Kept({ onChange }) {
  const [items, setItems] = useState(null);
  const load = () => getTransactions({ type: "kept" }).then((d) => setItems(d.items));
  useEffect(() => { load(); }, []);
  return (
    <>
      <Title sub="Money left in the machine when a customer timed out">Kept money</Title>
      {!items ? <div className="skeleton" /> : (
        <div className="card tx-list">
          {items.length === 0 ? <div className="empty">Nothing kept so far.</div> : items.map((t) => (
            <div key={t.id}>
              <TxRow t={t} />
              {!t.reviewed && (
                <button className="btn small white" style={{ marginBottom: 12, border: "2px solid var(--tint-2)" }}
                        onClick={() => markKeptReviewed(t.id).then(() => { load(); onChange?.(); })}>
                  Mark reviewed
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function Alerts() {
  const [d, setD] = useState(null);
  useEffect(() => { getOverview().then(setD); }, []);
  if (!d) return <><Title>Alerts</Title><div className="skeleton" /></>;
  const alerts = [];
  COINS.forEach((c) => {
    const s = coinStatus(d.stock[c]);
    if (s === "empty") alerts.push({ tone: "red", text: `₱${c} hopper is empty. Exchanges are paused.` });
    if (s === "low") alerts.push({ tone: "amber", text: `₱${c} hopper is low (${d.stock[c].count} coins).` });
  });
  if (d.gcashFloat.balance / d.gcashFloat.target < 0.2) alerts.push({ tone: "amber", text: "GCash float is running low." });
  if (d.keptToReview) alerts.push({ tone: "amber", text: `${d.keptToReview} kept amount to review.` });
  return (
    <>
      <Title sub="Things that need someone at the machine">Alerts</Title>
      {alerts.length === 0
        ? <div className="card empty">All clear. Nothing needs attention.</div>
        : alerts.map((a, i) => <div key={i} className={`note ${a.tone}`}>{a.text}</div>)}
    </>
  );
}

export function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { getSettings().then(setS); }, []);
  if (!s) return <><Title>Settings</Title><div className="skeleton" /></>;
  const set = (k) => (e) => { setSaved(false); setS({ ...s, [k]: e.target.value }); };
  return (
    <>
      <Title sub="Applies to Machine 01">Settings</Title>
      <form className="card" onSubmit={(e) => { e.preventDefault(); saveSettings(s).then(() => setSaved(true)); }}>
        <label className="field"><span>GCash fee (%)</span>
          <input className="input" inputMode="decimal" value={s.gcashFeePercent} onChange={set("gcashFeePercent")} /></label>
        <label className="field"><span>Mark a hopper low below (%)</span>
          <input className="input" inputMode="numeric" value={s.lowStockPercent} onChange={set("lowStockPercent")} /></label>
        <button className="btn primary">{saved ? "Saved" : "Save settings"}</button>
      </form>
    </>
  );
}

export function Users() {
  const [list, setList] = useState(null);
  useEffect(() => { getUsers().then(setList); }, []);
  return (
    <>
      <Title sub="Who can sign in to this admin site">Users and roles</Title>
      {!list ? <div className="skeleton" /> : (
        <div className="card tx-list">
          {list.map((u) => (
            <div className="tx" key={u.email}>
              <div className="tx-icon" style={{ fontWeight: 700 }}>{u.name[0]}</div>
              <div><div className="tx-title">{u.name}</div><div className="tx-meta">{u.email}</div></div>
              <span style={{ marginLeft: "auto" }}><Pill tone={u.role === "Admin" ? "blue" : "grey"}>{u.role}</Pill></span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function AuditLog() {
  const [data, setData] = useState(null);
  useEffect(() => { getStock().then(setData); }, []);
  return (
    <>
      <Title sub="Every refill, count and collection, newest first">Audit log</Title>
      {!data ? <div className="skeleton" /> : (
        <div className="card tx-list">
          {data.activity.map((a) => (
            <div className="tx" key={a.id}>
              <div><div className="tx-title">{a.text}</div>
                <div className="tx-meta">{a.who}, {dateOf(a.time)}, {timeOf(a.time)}</div></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
