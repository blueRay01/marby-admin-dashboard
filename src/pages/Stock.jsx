import { useEffect, useState } from "react";
import { COINS, coinStatus, collectCash, getStock } from "../api.js";
import { Bar, Pill, STATUS, Sheet, dateOf, peso, timeOf } from "../components/ui.jsx";

export default function Stock({ onChange }) {
  const [data, setData] = useState(null);
  const [sheet, setSheet] = useState(null); // "cash"
  const load = () => getStock().then(setData);
  useEffect(() => { load(); }, []);

  if (!data) return (<><h1 className="page-title">Stock</h1><div className="skeleton" /><div className="skeleton" /></>);

  const empty = COINS.filter((c) => data.stock[c].count === 0);
  const close = () => setSheet(null);
  const done = () => { setSheet(null); load(); onChange?.(); };

  return (
    <>
      <h1 className="page-title">Stock</h1>
      <p className="page-sub">Coin counts from the kiosk, and cash collected</p>

      <div className="btn-row" style={{ gridTemplateColumns: "1fr" }}>
        <button className="btn white" onClick={() => setSheet("cash")}>Collect cash</button>
      </div>

      {empty.length > 0 && (
        <div className="note red" role="alert">
          ₱{empty.join(", ₱")} hopper is empty. Coin exchanges are paused until it's refilled.
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Coins in the machine</h3>
          <div className="muted small" style={{ marginTop: 2 }}>
            {data.lastSeen ? `Reported by the kiosk ${dateOf(data.lastSeen)}, ${timeOf(data.lastSeen)}` : "The kiosk hasn't reported yet"}
          </div>
          {COINS.map((c, i) => {
            const s = coinStatus(data.stock[c]);
            return (
              <div key={c} style={{ marginTop: i ? 14 : 12 }}>
                <div className="row">
                  <b style={{ width: 40 }}>₱{c}</b>
                  <span className="muted small" style={{ flex: 1 }}>{data.stock[c].count} of {data.stock[c].capacity}</span>
                  <Pill tone={STATUS[s].tone}>{STATUS[s].label}</Pill>
                </div>
                <Bar value={data.stock[c].count / data.stock[c].capacity} tone={s === "low" ? "amber" : ""} />
              </div>
            );
          })}
          <p className="muted small" style={{ marginTop: 14, lineHeight: 1.5 }}>
            Refills are recorded on the kiosk. These counts update about once a minute.
          </p>
        </div>

        <div>
          <div className="card">
            <div className="row"><h3>Cash box</h3><Pill tone="grey">Since {dateOf(data.cashBox.since)}</Pill></div>
            <div className="row" style={{ marginTop: 12 }}><span className="label">Bills</span><b>{peso(data.cashBox.bills)}</b></div>
            <div className="row" style={{ marginTop: 8 }}><span className="label">Coins taken in</span><b>{peso(data.cashBox.coins)}</b></div>
          </div>

          <div className="card">
            <h3>Recent activity</h3>
            {data.activity.length === 0 && <div className="empty">Nothing yet.</div>}
            {data.activity.slice(0, 5).map((a) => (
              <div className="tx" key={a.id}>
                <div>
                  <div className="tx-title">{a.text}</div>
                  <div className="tx-meta">{a.who}, {dateOf(a.time)}, {timeOf(a.time)}</div>
                </div>
                <span style={{ marginLeft: "auto" }}>
                  <Pill tone={a.kind === "refill" ? "blue" : "grey"}>
                    {{ refill: "Refill", cash: "Cash", count: "Count", gcash: "GCash", incident: "Incident" }[a.kind]}
                  </Pill>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sheet === "cash" && <CashSheet box={data.cashBox} onClose={close} onDone={done} />}
    </>
  );
}

function CashSheet({ box, onClose, onDone }) {
  const total = box.bills + box.coins;
  return (
    <Sheet title="Collect cash" onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 14 }}>Empty the cash box, then confirm the amount.</p>
      <div className="row" style={{ marginBottom: 8 }}><span className="label">Bills</span><b>{peso(box.bills)}</b></div>
      <div className="row" style={{ marginBottom: 8 }}><span className="label">Coins taken in</span><b>{peso(box.coins)}</b></div>
      <div className="row" style={{ margin: "12px 0 18px", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <b>Total to collect</b><b style={{ fontSize: 20 }}>{peso(total)}</b></div>
      <button className="btn primary" disabled={!total} onClick={() => collectCash(total).then(onDone)}>
        Mark {peso(total)} collected
      </button>
    </Sheet>
  );
}
