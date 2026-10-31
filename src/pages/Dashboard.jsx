import { useEffect, useState } from "react";
import { COINS, coinStatus, getOverview } from "../api.js";
import { Bar, Pill, STATUS, peso } from "../components/ui.jsx";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Dashboard({ user, go }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => getOverview().then((d) => alive && setData(d));
    load();
    const id = setInterval(load, 15000); // refresh every 15 s
    return () => { alive = false; clearInterval(id); };
  }, []);

  const date = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" });

  return (
    <>
      <h1 className="page-title">{greeting()}, {user.name.split(" ")[0]}</h1>
      <p className="page-sub">{date}</p>
      {!data ? <><div className="skeleton" /><div className="skeleton" /></> : <Body data={data} go={go} />}
    </>
  );
}

function Body({ data, go }) {
  const { machine, stock, gcashFloat, kpis, hourly } = data;
  const paused = machine.state === "paused" || machine.state === "offline";
  const peak = hourly.indexOf(Math.max(...hourly));
  const hourLabel = (i) => {
    const h = 8 + i;
    return `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
  };
  const floatShare = gcashFloat.balance / gcashFloat.target;

  return (
    <>
      <div className="card">
        <div className="row">
          <div>
            <div className="label">{machine.name}, {machine.location}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: paused ? "var(--red)" : "var(--ink)" }}>
              {machine.state === "running" ? "Running" : machine.state === "paused" ? "Paused" : "Offline"}
            </div>
          </div>
          <Pill tone={paused ? "red" : "blue"} dot>{machine.reason}</Pill>
        </div>
        <div className="row small" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <span style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 700, color: machine.online ? "var(--blue)" : "var(--red)" }}>
            <span className="pill" style={{ padding: 0, height: "auto" }}><span className="dot" /></span>
            {machine.online ? "Online" : "Offline"}
          </span>
          <span className="muted">Last check-in {machine.lastSeenSeconds}s ago</span>
        </div>
      </div>

      {machine.state === "paused" && (
        <button className="note red" style={{ width: "100%", textAlign: "left" }} onClick={() => go("stock")}>
          <span>Refill ₱{machine.coin} coins to resume exchanges.</span>
          <span className="link">Stock</span>
        </button>
      )}

      <div className="kpis">
        <div className="kpi"><div className="label">Exchanges</div><div className="n">{kpis.exchanges}</div>
          <div className="d">+{kpis.exchangesDelta} vs yesterday</div></div>
        <div className="kpi"><div className="label">Cash-ins</div><div className="n">{kpis.cashIns}</div>
          <div className="d">{peso(kpis.cashInTotal)} sent</div></div>
        <div className="kpi"><div className="label">Fees</div><div className="n">{peso(kpis.fees)}</div>
          <div className="d">from cash-ins</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="row"><h3>Coin stock</h3><span className="muted small">per hopper</span></div>
          {COINS.map((c, i) => {
            const s = coinStatus(stock[c]);
            return (
              <div key={c} style={{ marginTop: i ? 14 : 10 }}>
                <div className="row">
                  <b style={{ width: 40 }}>₱{c}</b>
                  <span className="muted small" style={{ flex: 1 }}>{stock[c].count} coins</span>
                  <Pill tone={STATUS[s].tone}>{STATUS[s].label}</Pill>
                </div>
                <Bar value={stock[c].count / stock[c].capacity} tone={s === "low" ? "amber" : ""} />
              </div>
            );
          })}
        </div>

        <div>
          <button className="card" style={{ width: "100%", textAlign: "left", display: "block" }} onClick={() => go("gcash")}>
            <div className="row">
              <div><div className="label">GCash float</div><div className="big-num">{peso(gcashFloat.balance)}</div></div>
              <Pill tone={floatShare < 0.2 ? "amber" : "blue"}>{floatShare < 0.2 ? "Top up soon" : "Enough for today"}</Pill>
            </div>
            <Bar value={floatShare} tone={floatShare < 0.2 ? "amber" : ""} />
          </button>

          <div className="card">
            <div className="row"><h3>Today by hour</h3><span className="muted small">Busiest {hourLabel(peak)}</span></div>
            <div className="spark" aria-label="Transactions per hour">
              {hourly.map((v, i) => (
                <i key={i} className={i === peak ? "hi" : ""} style={{ height: `${(v / hourly[peak]) * 100}%` }}
                   title={`${hourLabel(i)}: ${v}`} />
              ))}
            </div>
            <div className="row muted" style={{ fontSize: 11, marginTop: 6 }}>
              <span>8 AM</span><span>12 PM</span><span>5 PM</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
