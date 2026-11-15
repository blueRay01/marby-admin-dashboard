import { useEffect, useState } from "react";
import {
  COINS, coinStatus, getGcashRequests, getIncidents, getOverview, getSettings, getStock, getUsers,
  markGcashSent, resolveIncident, saveSettings, topUpFloat,
} from "../api.js";
import { Bar, Icon, Pill, Sheet, dateOf, peso, timeOf } from "../components/ui.jsx";
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

const spaced = (n = "") => `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;

function waited(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="seg" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? "on" : ""}
                onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

export function GcashRequests({ onChange }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("pending");
  const [confirm, setConfirm] = useState(null);   // request being marked sent
  const [topUp, setTopUp] = useState(false);
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState("");
  const load = () => getGcashRequests().then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return <><Title>GCash requests</Title><div className="skeleton" /></>;

  const { pending, sent, float } = data;
  const owed = pending.reduce((s, t) => s + t.amount, 0);
  const share = float.balance / float.target;
  const short = owed > float.balance;
  const copy = (t) => navigator.clipboard?.writeText(t.gcashNumber).then(() => {
    setCopied(t.ref); setTimeout(() => setCopied(null), 1500);
  });
  const send = () => markGcashSent(confirm.ref)
    .then(() => { setConfirm(null); setError(""); load(); onChange?.(); })
    .catch((e) => setError(e.message));

  return (
    <>
      <Title sub="Send each one from the team's GCash app, then mark it sent">GCash requests</Title>

      <div className="card">
        <div className="row">
          <div><div className="label">GCash float</div><div className="big-num">{peso(float.balance)}</div></div>
          <Pill tone={share < 0.2 || short ? "amber" : "blue"}>{short ? "Not enough to send all" : share < 0.2 ? "Top up soon" : "Enough for today"}</Pill>
        </div>
        <Bar value={share} tone={share < 0.2 || short ? "amber" : ""} />
        <div className="row small" style={{ marginTop: 10 }}>
          <span className="muted">{pending.length ? `${peso(owed)} waiting to be sent` : `Target ${peso(float.target)}`}</span>
          <button className="link-btn" onClick={() => setTopUp(true)}>Record top-up</button>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab}
            tabs={[{ id: "pending", label: `To send (${pending.length})` }, { id: "sent", label: `Sent (${sent.length})` }]} />

      {tab === "pending" && (pending.length === 0
        ? <div className="card empty">All caught up. No cash-ins waiting.</div>
        : pending.map((t) => (
          <div className="card req" key={t.ref}>
            <div className="row">
              <span className="label">Ref {t.ref}, {timeOf(t.time)}</span>
              <Pill tone="amber">Waiting {waited(t.time)}</Pill>
            </div>
            <div className="req-amount">{peso(t.amount)} <span>to send</span></div>
            <div className="req-who">
              <div>
                <div className="req-name">{t.gcashName}</div>
                <div className="req-number">{spaced(t.gcashNumber)}</div>
              </div>
              <button className="copy-btn" onClick={() => copy(t)} aria-label="Copy GCash number">
                {copied === t.ref ? Icon.check : Icon.copy}<span>{copied === t.ref ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="muted small" style={{ margin: "10px 0 14px" }}>
              Customer inserted {peso(t.received)} in coins, fee {peso(t.fee)}
            </div>
            <button className="btn primary" onClick={() => { setError(""); setConfirm(t); }}>Mark as sent</button>
          </div>
        )))}

      {tab === "sent" && (
        <div className="card tx-list">
          {sent.length === 0 ? <div className="empty">Nothing sent yet.</div> : sent.map((t) => (
            <div key={t.ref}>
              <TxRow t={t} />
              <div className="tx-note">Sent by {t.sentBy}, {timeOf(t.sentAt)}</div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <Sheet title="Did you send it?" onClose={() => setConfirm(null)}>
          <p className="muted small" style={{ marginBottom: 14 }}>Only confirm after the transfer goes through in the GCash app.</p>
          <div className="confirm-box">
            <div className="req-amount">{peso(confirm.amount)}</div>
            <div className="req-name">{confirm.gcashName}</div>
            <div className="req-number">{spaced(confirm.gcashNumber)}</div>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" onClick={send}>Yes, I sent it</button>
        </Sheet>
      )}

      {topUp && (
        <Sheet title="Record top-up" onClose={() => setTopUp(false)}>
          <label className="field"><span>Amount added to the float</span>
            <input className="input" inputMode="numeric" autoFocus value={amount}
                   onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 1000" />
          </label>
          <button className="btn primary" disabled={!Number(amount)}
                  onClick={() => topUpFloat(Number(amount)).then(() => { setTopUp(false); setAmount(""); load(); })}>
            Save top-up
          </button>
        </Sheet>
      )}
    </>
  );
}

function incidentText(t) {
  const d = t.info || {};
  switch (t.incident) {
    case "jam":
      return "Coins got stuck while paying out. Clear the jam, then use Kiosk controls on the machine to mark it fixed.";
    case "hardware":
      return "The machine stopped itself for safety. Someone needs to check it on site.";
    case "cant_change":
      return "The machine took a bill but didn't have the coins to change it.";
    case "wrong_bill_unpayable":
      return `Customer picked ₱${d.picked_bill} but inserted a ₱${d.bill} bill the machine couldn't change.`;
    case "overpayment":
      return "Customer put in more than needed.";
    case "timeout":
      return "Customer walked away with money still in the machine.";
    default:
      return "Check the machine and the customer's receipt.";
  }
}

export function Incidents({ onChange }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("open");
  const [resolving, setResolving] = useState(null);
  const [note, setNote] = useState("");
  const load = () => getIncidents().then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return <><Title>Incidents</Title><div className="skeleton" /></>;
  const { open, resolved } = data;
  const save = () => resolveIncident(resolving.ref, note.trim())
    .then(() => { setResolving(null); setNote(""); load(); onChange?.(); });

  return (
    <>
      <Title sub="Money the machine owes a customer, or problems that need someone">Incidents</Title>
      <Tabs value={tab} onChange={setTab}
            tabs={[{ id: "open", label: `Open (${open.length})` }, { id: "resolved", label: `Resolved (${resolved.length})` }]} />

      {tab === "open" && (open.length === 0
        ? <div className="card empty">No open incidents.</div>
        : open.map((t) => (
          <div className="card req" key={t.ref}>
            <div className="row">
              <span className="label">Ref {t.ref}, {timeOf(t.time)}</span>
              <Pill tone="red">Open {waited(t.time)}</Pill>
            </div>
            <div className="row" style={{ marginTop: 10, alignItems: "flex-start" }}>
              <div className="tx-icon red">{Icon.incident}</div>
              <div style={{ flex: 1 }}>
                <div className="tx-title">{t.title}</div>
                <div className="muted small" style={{ marginTop: 4, lineHeight: 1.5 }}>{incidentText(t)}</div>
              </div>
            </div>
            <div className="row" style={{ margin: "14px 0", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <span className="label">Owed to customer</span><b style={{ fontSize: 20 }}>{peso(t.amount)}</b>
            </div>
            <button className="btn white outline" onClick={() => setResolving(t)}>Mark resolved</button>
          </div>
        )))}

      {tab === "resolved" && (
        <div className="card tx-list">
          {resolved.length === 0 ? <div className="empty">Nothing resolved yet.</div> : resolved.map((t) => (
            <div key={t.ref}>
              <TxRow t={t} />
              <div className="tx-note">Resolved by {t.resolvedBy}, {timeOf(t.resolvedAt)}{t.note ? `: ${t.note}` : ""}</div>
            </div>
          ))}
        </div>
      )}

      {resolving && (
        <Sheet title="Mark resolved" onClose={() => setResolving(null)}>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Ref {resolving.ref}, {peso(resolving.amount)} owed. Only mark it resolved once the customer has their money.
          </p>
          <label className="field"><span>How was it settled? (optional)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)}
                   placeholder="e.g. Paid back ₱30 in cash" autoFocus />
          </label>
          <button className="btn primary" onClick={save}>Mark resolved</button>
        </Sheet>
      )}
    </>
  );
}

export function Alerts({ go }) {
  const [d, setD] = useState(null);
  useEffect(() => { getOverview().then(setD); }, []);
  if (!d) return <><Title>Alerts</Title><div className="skeleton" /></>;
  const alerts = [];
  if (d.machine.service) alerts.push({ tone: "red", text: "Machine needs service. Exchanges are paused.", to: "incidents" });
  COINS.forEach((c) => {
    const s = coinStatus(d.stock[c]);
    if (s === "empty") alerts.push({ tone: "red", text: `₱${c} hopper is empty. Exchanges are paused.`, to: "stock" });
    if (s === "low") alerts.push({ tone: "amber", text: `₱${c} hopper is low (${d.stock[c].count} coins).`, to: "stock" });
  });
  if (d.incidentsOpen) alerts.push({ tone: "red", text: `${d.incidentsOpen} open incident${d.incidentsOpen > 1 ? "s" : ""}. A customer is owed money.`, to: "incidents" });
  if (d.gcashPending) alerts.push({ tone: "amber", text: `${d.gcashPending} GCash cash-in${d.gcashPending > 1 ? "s" : ""} waiting to be sent (${peso(d.gcashPendingTotal)}).`, to: "gcash" });
  if (d.gcashFloat.balance / d.gcashFloat.target < 0.2) alerts.push({ tone: "amber", text: "GCash float is running low.", to: "gcash" });
  return (
    <>
      <Title sub="Things that need someone at the machine">Alerts</Title>
      {alerts.length === 0
        ? <div className="card empty">All clear. Nothing needs attention.</div>
        : alerts.map((a, i) => (
          <button key={i} className={`note ${a.tone}`} style={{ width: "100%", textAlign: "left" }} onClick={() => go?.(a.to)}>
            <span>{a.text}</span><span className="link">Open</span>
          </button>
        ))}
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
      <Title sub="Every refill, count, collection, GCash send and resolved incident, newest first">Audit log</Title>
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
