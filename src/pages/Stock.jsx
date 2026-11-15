import { useEffect, useState } from "react";
import { COINS, cancelAdjustment, coinStatus, collectCash, getStock, recordRefill, saveCount } from "../api.js";
import { Bar, Pill, STATUS, Sheet, dateOf, peso, timeOf } from "../components/ui.jsx";

export default function Stock({ onChange }) {
  const [data, setData] = useState(null);
  const [sheet, setSheet] = useState(null); // "refill" | "count" | "cash"
  const load = () => getStock().then(setData);
  useEffect(() => {
    load();
    const id = setInterval(load, 10000); // pick up the kiosk applying queued changes
    return () => clearInterval(id);
  }, []);

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

      {data.pending.length > 0 && (
        <div className="card">
          <div className="row"><h3>Waiting for the kiosk</h3><Pill tone="amber">{data.pending.length} queued</Pill></div>
          <div className="muted small" style={{ marginTop: 2 }}>
            The kiosk applies these within about 15 seconds, once no one is mid-transaction.
          </div>
          {data.pending.map((a) => (
            <div className="tx" key={a.id}>
              <div>
                <div className="tx-title">
                  {a.kind === "refill" ? `Refill ₱${a.coin} +${a.amount} coins` : `Count ₱${a.coin}: ${a.amount} coins`}
                </div>
                <div className="tx-meta">{a.who}, {timeOf(a.time)}</div>
              </div>
              <button className="link-btn" style={{ marginLeft: "auto" }}
                      onClick={() => cancelAdjustment(a.id).then(load).catch((e) => alert(e.message))}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

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
          <button className="btn primary" style={{ marginTop: 14 }} onClick={() => setSheet("count")}>Count stock</button>
          <p className="muted small" style={{ marginTop: 10, lineHeight: 1.5 }}>
            Counts come from the kiosk and update about once a minute.
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

      {sheet === "refill" && <RefillSheet stock={data.stock} pending={data.pending} onClose={close} onDone={done} />}
      {sheet === "count" && <CountSheet stock={data.stock} onClose={close} onDone={done} />}
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

function RefillSheet({ stock, pending, onClose, onDone }) {
  const [coin, setCoin] = useState(COINS.find((c) => coinStatus(stock[c]) !== "good") || 5);
  const [count, setCount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const n = parseInt(count, 10) || 0;
  const queued = pending.filter((a) => a.coin === coin && a.kind === "refill").reduce((s, a) => s + a.amount, 0);
  const room = Math.max(0, stock[coin].capacity - stock[coin].count - queued);
  const save = () => {
    setBusy(true);
    recordRefill(coin, n).then(onDone).catch((e) => { setError(e.message); setBusy(false); });
  };
  return (
    <Sheet title="Record refill" onClose={onClose}>
      <p className="muted small">Fill the hopper first, then record how many coins you added.</p>
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
      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={!n || n > room || busy} onClick={save}>
        {busy ? "Saving…" : "Save refill"}
      </button>
    </Sheet>
  );
}

function CountSheet({ stock, onClose, onDone }) {
  const [counts, setCounts] = useState(() => Object.fromEntries(COINS.map((c) => [c, ""])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const filled = Object.fromEntries(COINS.filter((c) => counts[c] !== "").map((c) => [c, Number(counts[c])]));
  const save = () => {
    setBusy(true);
    saveCount(filled).then(onDone).catch((e) => { setError(e.message); setBusy(false); });
  };
  return (
    <Sheet title="Count stock" onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Count a hopper and enter what's really in it. Leave a coin blank to skip it.
      </p>
      {COINS.map((c) => (
        <label key={c} className="field" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <b style={{ width: 44 }}>₱{c}</b>
          <input className="input" inputMode="numeric" value={counts[c]} placeholder={`Kiosk says ${stock[c].count}`}
                 onChange={(e) => setCounts({ ...counts, [c]: e.target.value.replace(/\D/g, "") })} />
        </label>
      ))}
      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={!Object.keys(filled).length || busy} onClick={save}>
        {busy ? "Saving…" : "Save count"}
      </button>
    </Sheet>
  );
}
