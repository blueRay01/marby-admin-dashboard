import { useEffect, useState } from "react";
import { getTransactions } from "../api.js";
import { Icon, Pill, peso, timeOf } from "../components/ui.jsx";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "exchange", label: "Exchange" },
  { id: "gcash", label: "GCash" },
  { id: "refund", label: "Refunds" },
  { id: "incident", label: "Incidents" },
];

export const TITLES = {
  bill: "Bill to coins", break: "Break coins", combine: "Combine coins",
  gcash: "GCash cash-in", refund: "GCash cancelled",
};

export const txTitle = (t) => (t.type === "incident" ? t.title : TITLES[t.type]);

const PAGE = 7;

function StatusPill({ t }) {
  if (t.type === "gcash") {
    return t.gcashStatus === "sent" ? <Pill tone="blue">Sent</Pill> : <Pill tone="amber">To send</Pill>;
  }
  if (t.type === "incident") {
    return t.resolved ? <Pill tone="grey">Resolved</Pill> : <Pill tone="red">Owes {peso(t.amount)}</Pill>;
  }
  if (t.type === "refund") return <Pill tone="grey">Coins returned</Pill>;
  return null;
}

export function TxRow({ t }) {
  const tone = t.type === "incident" && !t.resolved ? "red" : t.type === "gcash" && t.gcashStatus === "pending" ? "amber" : "";
  return (
    <div className="tx">
      <div className={`tx-icon ${tone}`}>{Icon[t.type]}</div>
      <div style={{ minWidth: 0 }}>
        <div className="tx-title">{txTitle(t)}</div>
        <div className="tx-meta">{timeOf(t.time)}, Ref {t.ref}{t.detail ? `, ${t.detail}` : ""}</div>
      </div>
      <div className="tx-amt">
        {peso(t.amount)}
        {t.fee ? <Pill tone="grey">Fee {peso(t.fee)}</Pill> : null}
        <StatusPill t={t} />
      </div>
    </div>
  );
}

function downloadCsv(items) {
  const head = ["ref", "type", "time", "amount", "fee", "status", "detail"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const status = (t) => t.gcashStatus || (t.type === "incident" ? (t.resolved ? "resolved" : "open") : "completed");
  const rows = items.map((t) => [t.ref, txTitle(t), new Date(t.time).toLocaleString("en-PH"), t.amount, t.fee || 0, status(t), t.detail]);
  const csv = [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `dmarby-transactions.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

export default function Transactions() {
  const [type, setType] = useState("all");
  const [range, setRange] = useState("today");
  const [data, setData] = useState(null);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    setData(null);
    setShown(PAGE);
    getTransactions({ type, range }).then(setData);
  }, [type, range]);

  return (
    <>
      <h1 className="page-title">Transactions</h1>
      <p className="page-sub">
        {data ? `${data.summary.count} today, ${peso(data.summary.handled)} handled` : "Loading…"}
      </p>

      <div className="seg" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={type === f.id} className={type === f.id ? "on" : ""}
                  onClick={() => setType(f.id)}>{f.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <select className="select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">Last 7 days</option>
          <option value="month">This month</option>
        </select>
        <button className="btn white small" disabled={!data?.items.length} onClick={() => downloadCsv(data.items)}>
          Export CSV
        </button>
      </div>

      {!data ? <div className="skeleton" style={{ height: 300 }} /> : (
        <>
          <div className="card tx-list">
            {data.items.length === 0
              ? <div className="empty">No transactions match this filter.</div>
              : data.items.slice(0, shown).map((t) => <TxRow key={t.id} t={t} />)}
          </div>
          {shown < data.items.length && (
            <button className="btn ghost" onClick={() => setShown((n) => n + PAGE)}>Load more</button>
          )}
        </>
      )}
    </>
  );
}
