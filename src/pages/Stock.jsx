import { useEffect, useState } from "react";
import { COINS, coinStatus, collectCash, getStock, recordRefill, saveCount } from "../api.js";
import { Pill, Sheet, dateOf, peso, timeOf } from "../components/ui.jsx";

export default function Stock({ onChange }) {
  const [data, setData] = useState(null);
  const [sheet, setSheet] = useState(null); // "refill" | "cash" | "count"
  const load = () => getStock().then(setData);
  useEffect(() => { load(); }, []);

  if (!data) return (<><h1 className="page-title">Stock</h1><div className="skeleton" /><div className="skeleton" /></>);

  const empty = COINS.filter((c) => data.stock[c].count === 0);
  const close = () => setSheet(null);
  const done = () => { setSheet(null); load(); onChange?.(); };

  return (
    <>
      <h1 className="page-title">Stock</h1>
      <p className="page-sub">Refills, counts and cash collected</p>

      <div className="btn-row">
        <button className="btn white" onClick={() => setSheet("refill")}>Record refill</button>
        <button className="btn ghost" onClick={() => setSheet("cash")}>Collect cash</button>
      </div>

      {empty.length > 0 && (
        <div className="note red" role="alert">
          ₱{empty.join(", ₱")} hopper is empty. Coin exchanges are paused until it's refilled.
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Stock check</h3>
          <div className="muted small" style={{ marginTop: 2 }}>Expected = start + refills − payouts</div>
          <table className="table">
            <thead><tr><th>Coin</th><th>Expected</th><th>Counted</th><th>Diff</th></tr></thead>
            <tbody>
              {COINS.map((c) => {
                const expected = data.stock[c].count;
                const last = data.lastCount[c];
                const counted = last ? last.counted : null;
                const diff = last ? last.counted - last.expected : null;
                return (
                  <tr key={c}>
                    <td>₱{c}</td>
                    <td>{expected}</td>
                    <td className={counted == null ? "dim" : ""}>{counted ?? "Not yet"}</td>
                    <td className={diff ? "bad" : "dim"}>{diff == null ? "–" : diff > 0 ? `+${diff}` : diff}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setSheet("count")}>Count stock now</button>
        </div>

        <div>
          <div className="note amber">₱5 runs out fastest, about every 2 days. Try refilling 120 instead of 100.</div>

          <div className="card">
            <div className="row"><h3>Cash box</h3><Pill tone="grey">Since {dateOf(data.cashBox.since)}</Pill></div>
            <div className="row" style={{ marginTop: 12 }}><span className="label">Bills</span><b>{peso(data.cashBox.bills)}</b></div>
            <div className="row" style={{ marginTop: 8 }}><span className="label">Coins taken in</span><b>{peso(data.cashBox.coins)}</b></div>
          </div>

          <div className="card">
            <h3>Recent activity</h3>
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

      {sheet === "refill" && <RefillSheet stock={data.stock} onClose={close} onDone={done} />}
      {sheet === "cash" && <CashSheet box={data.cashBox} onClose={close} onDone={done} />}
      {sheet === "count" && <CountSheet stock={data.stock} last={data.lastCount} onClose={close} onDone={done} />}
    </>
  );
}

function RefillSheet({ stock, onClose, onDone }) {
  const [coin, setCoin] = useState(COINS.find((c) => coinStatus(stock[c]) !== "good") || 5);
  const [count, setCount] = useState("");
  const n = parseInt(count, 10) || 0;
  const room = stock[coin].capacity - stock[coin].count;
  return (
    <Sheet title="Record refill" onClose={onClose}>
      <p className="muted small">Which hopper did you fill?</p>
      <div className="choice">
        {COINS.map((c) => (
          <button key={c} className={c === coin ? "on" : ""} onClick={() => setCoin(c)}>₱{c}</button>
        ))}
      </div>
      <label className="field"><span>Coins added (room for {room})</span>
        <input className="input" inputMode="numeric" value={count} autoFocus
               onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 100" />
      </label>
      {n > room && <p className="error">That's more than the hopper holds ({room} left).</p>}
      <button className="btn primary" disabled={!n || n > room}
              onClick={() => recordRefill(coin, n).then(onDone)}>Save refill</button>
    </Sheet>
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

function CountSheet({ stock, last, onClose, onDone }) {
  const [counts, setCounts] = useState(() =>
    Object.fromEntries(COINS.map((c) => [c, ""])));
  const ready = COINS.every((c) => counts[c] !== "");
  return (
    <Sheet title="Count stock" onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 12 }}>Count each hopper and enter what you find.</p>
      {COINS.map((c) => (
        <label key={c} className="field" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <b style={{ width: 44 }}>₱{c}</b>
          <input className="input" inputMode="numeric" value={counts[c]} placeholder={`Expected ${stock[c].count}`}
                 onChange={(e) => setCounts({ ...counts, [c]: e.target.value.replace(/\D/g, "") })} />
        </label>
      ))}
      <button className="btn primary" disabled={!ready}
              onClick={() => saveCount(Object.fromEntries(COINS.map((c) => [c, Number(counts[c])]))).then(onDone)}>
        Save count
      </button>
    </Sheet>
  );
}
