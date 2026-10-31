import { useEffect, useState } from "react";
import { getTransactions } from "../api.js";
import { Icon, Pill, peso, timeOf } from "../components/ui.jsx";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "exchange", label: "Exchange" },
  { id: "gcash", label: "GCash" },
  { id: "kept", label: "Kept" },
];

const TITLES = {
  bill: "Bill to coins", break: "Break coins", combine: "Combine coins",
  gcash: "GCash cash-in", kept: "Kept after timeout",
};

const PAGE = 7;

export function TxRow({ t }) {
  return (
    <div className="tx">
      <div className={`tx-icon ${t.type === "kept" ? "amber" : ""}`}>{Icon[t.type]}</div>
      <div>
        <div className="tx-title">{TITLES[t.type]}</div>
        <div className="tx-meta">{timeOf(t.time)}, {t.detail}</div>
      </div>
      <div className="tx-amt">
        {peso(t.amount)}
        {t.fee ? <Pill tone="grey">Fee {peso(t.fee)}</Pill> : null}
        {t.type === "kept" && !t.reviewed ? <Pill tone="amber">Review</Pill> : null}
      </div>
    </div>
  );
}

function downloadCsv(items) {
  const head = ["id", "type", "time", "amount", "fee", "detail"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = items.map((t) => [t.id, TITLES[t.type], new Date(t.time).toLocaleString("en-PH"), t.amount, t.fee || 0, t.detail]);
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
