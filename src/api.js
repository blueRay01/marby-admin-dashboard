// All data the admin site shows comes through this file.
// Right now it returns sample data kept in memory. When the kiosk backend is
// ready, replace each function body with a fetch() to the real endpoint and
// keep the same return shapes, so no page has to change.
//
// Transactions are stored exactly like rows in the kiosk's
// transaction_numbers.sqlite3 (number, created_at, mode, kind, status, details).
// toTx() turns a row into what the pages show, so real rows can drop straight in.

import { configured, supabase } from "./supabase.js";

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export const COINS = [20, 10, 5, 1];

const today = new Date();
const at = (h, m) => {
  const d = new Date(today);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
// The kiosk writes local time as "YYYY-MM-DD HH:MM:SS".
const kioskTime = (h, m) => {
  const d = new Date(today);
  d.setHours(h, m, 0, 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(h)}:${p(m)}:00`;
};
const fromKioskTime = (s) => new Date(s.replace(" ", "T")).toISOString();

// ---- Sample kiosk rows (newest first) ----
// kind: "cash" | "gcash"
// status: "completed" | "pending" | "sent" | "refunded" | "incident" | "forfeit"
// Fields outside `details` (sent_at, resolved_at, ...) are added by the dashboard, not the kiosk.
const rows = [
  { number: "000041", created_at: kioskTime(14, 41), mode: "hardware", kind: "gcash", status: "pending",
    details: { amount: 97, fee: 3, received: 100, number: "09171234567", name: "JUAN DELA CRUZ" } },
  { number: "000040", created_at: kioskTime(14, 33), mode: "hardware", kind: "cash", status: "completed",
    details: { flow: "bill", amount: 50, plan: { 20: 2, 5: 2 } } },
  { number: "000039", created_at: kioskTime(14, 20), mode: "hardware", kind: "gcash", status: "refunded",
    details: { flow: "gcash", amount: 20, plan: { 10: 2 } } },
  { number: "000038", created_at: kioskTime(14, 5), mode: "hardware", kind: "cash", status: "incident",
    details: { type: "jam", owed: 30, flow: "bill", inserted: [["bill", 50]] } },
  { number: "000037", created_at: kioskTime(13, 52), mode: "hardware", kind: "cash", status: "completed",
    details: { flow: "break", amount: 20, plan: { 10: 1, 1: 10 } } },
  { number: "000036", created_at: kioskTime(13, 48), mode: "hardware", kind: "gcash", status: "pending",
    details: { amount: 51, fee: 2, received: 53, number: "09281101102", name: "MA. ANGELICA REYES" } },
  { number: "000035", created_at: kioskTime(13, 30), mode: "hardware", kind: "gcash", status: "sent",
    details: { amount: 48, fee: 2, received: 50, number: "09953301310", name: "KLYDEL SANTOS" },
    sent_at: at(13, 41), sent_by: "Mara D." },
  { number: "000034", created_at: kioskTime(13, 12), mode: "hardware", kind: "cash", status: "completed",
    details: { flow: "bill", amount: 100, plan: { 20: 5 } } },
  { number: "000033", created_at: kioskTime(12, 58), mode: "hardware", kind: "cash", status: "completed",
    details: { flow: "break", amount: 10, plan: { 5: 2 } } },
  { number: "000032", created_at: kioskTime(12, 41), mode: "hardware", kind: "cash", status: "incident",
    details: { type: "wrong_bill_unpayable", owed: 100, flow: "bill", inserted: [["bill", 100]],
               bill: 100, picked_bill: 50 },
    resolved_at: at(13, 5), resolved_by: "Jun R." },
  { number: "000031", created_at: kioskTime(12, 15), mode: "hardware", kind: "cash", status: "completed",
    details: { flow: "combine", amount: 20, plan: { 20: 1 } } },
  { number: "000030", created_at: kioskTime(11, 47), mode: "hardware", kind: "cash", status: "completed",
    details: { flow: "bill", amount: 50, plan: { 20: 2, 10: 1 } } },
  { number: "000029", created_at: kioskTime(11, 20), mode: "hardware", kind: "gcash", status: "sent",
    details: { amount: 19, fee: 1, received: 20, number: "09175550199", name: "EDWARD LIM" },
    sent_at: at(11, 32), sent_by: "Jun R." },
  { number: "000028", created_at: kioskTime(10, 33), mode: "hardware", kind: "cash", status: "completed",
    details: { flow: "bill", amount: 50, plan: { 10: 5 } } },
];

const INCIDENT_TITLES = {
  jam: "Coins got stuck",
  hardware: "Service required",
  cant_change: "Couldn't give change",
  wrong_bill_unpayable: "Wrong bill, couldn't change",
  overpayment: "Overpaid",
  timeout: "Customer left money",
};

const FLOW_NAMES = { bill: "bill to coins", break: "break coins", combine: "combine coins", gcash: "GCash" };

const describe = (plan = {}) =>
  Object.keys(plan).map(Number).sort((a, b) => b - a)
    .map((c) => (plan[c] === 1 ? `₱${c}` : `${plan[c]} × ₱${c}`)).join(" + ");
const coinsIn = (plan = {}) => Object.values(plan).reduce((s, n) => s + n, 0);
const masked = (n = "") => `${n.slice(0, 4)} *** ${n.slice(7)}`;

/** One kiosk row -> what the pages show. */
export function toTx(r) {
  const d = r.details || {};
  const base = { id: r.number, ref: r.number, time: fromKioskTime(r.created_at), mode: r.mode };
  if (r.status === "incident" || r.status === "forfeit") {
    const type = r.status === "forfeit" ? "timeout" : d.type;
    return { ...base, type: "incident", incident: type, title: INCIDENT_TITLES[type] || "Incident", info: d,
             note: r.resolution_note,
             amount: d.owed ?? d.amount ?? 0, detail: d.flow ? `During ${FLOW_NAMES[d.flow] || d.flow}` : "",
             resolved: Boolean(r.resolved_at), resolvedAt: r.resolved_at, resolvedBy: r.resolved_by };
  }
  if (r.status === "refunded") {
    return { ...base, type: "refund", amount: d.amount, detail: `Coins returned: ${describe(d.plan)}` };
  }
  if (r.kind === "gcash") {
    return { ...base, type: "gcash", amount: d.amount, fee: d.fee, received: d.received,
             gcashNumber: d.number, gcashName: d.name, detail: `${masked(d.number)}, ${d.name}`,
             gcashStatus: r.status, sentAt: r.sent_at, sentBy: r.sent_by };
  }
  const n = coinsIn(d.plan);
  const detail = d.flow === "bill" ? `₱${d.amount} bill, ${n} coin${n === 1 ? "" : "s"}` : `Gave ${describe(d.plan)}`;
  return { ...base, type: d.flow, amount: d.amount, detail };
}

const db = {
  user: null,
  machine: {
    name: "Machine 01",
    location: "Main Lobby",
    online: true,
    lastSeenSeconds: 12,
  },
  // count = coins in the hopper now, capacity = full hopper (kiosk: START_STOCK / config)
  stock: {
    20: { count: 38, capacity: 60 },
    10: { count: 54, capacity: 80 },
    5: { count: 0, capacity: 100 },
    1: { count: 31, capacity: 200 },
  },
  gcashFloat: { balance: 1850, target: 3000 },
  cashBox: { since: at(6, 2) },
  // last physical count per hopper, with what the machine expected at that moment
  lastCount: { 20: { counted: 38, expected: 38 }, 10: { counted: 52, expected: 54 }, 5: { counted: 0, expected: 0 }, 1: null },
  activity: [
    { id: "A-4", kind: "gcash", text: "Sent ₱48 to GCash (Ref 000035)", who: "Mara D.", time: at(13, 41) },
    { id: "A-3", kind: "refill", text: "Refill ₱5 +100 coins", who: "Mara D.", time: at(9, 10) },
    { id: "A-2", kind: "cash", text: "Collected ₱3,500", who: "Jun R.", time: at(6, 2) },
  ],
  users: [
    { name: "Mara D.", email: "mara@dmarby.ph", role: "Admin" },
    { name: "Jun R.", email: "jun@dmarby.ph", role: "Staff" },
    { name: "Klydel S.", email: "klydel@dmarby.ph", role: "Staff" },
  ],
  settings: { contactNumber: "09XX XXX XXXX", gcashFeePercent: 3, lowStockPercent: 25 },
};

const txs = () => rows.map(toTx);
const openIncidents = () => txs().filter((t) => t.type === "incident" && !t.resolved);
const pendingGcash = () => txs().filter((t) => t.type === "gcash" && t.gcashStatus === "pending");

/** Money that went into the cash box since the last collection (bills + coins inserted). */
function cashBoxTotals() {
  const since = new Date(db.cashBox.since);
  let bills = 0, coins = 0;
  for (const r of rows) {
    if (new Date(fromKioskTime(r.created_at)) < since) continue;
    const d = r.details || {};
    if (r.status === "incident" || r.status === "forfeit") {
      for (const [src, v] of d.inserted || []) src === "bill" ? (bills += v) : (coins += v);
    } else if (r.kind === "gcash" && r.status !== "refunded") {
      coins += d.received || 0;
    } else if (r.status === "refunded") {
      coins += d.amount || 0;   // coins went in, same value came back out of the hoppers
    } else if (d.flow === "bill") {
      bills += d.amount || 0;
    } else {
      coins += d.amount || 0;
    }
  }
  return { since: db.cashBox.since, bills, coins };
}

// ---- Status helpers (shared by pages) ----
export function coinStatus({ count, capacity }, lowPercent = db.settings.lowStockPercent) {
  if (count === 0) return "empty";
  if (count / capacity < lowPercent / 100) return "low";
  return "good";
}

export function machineState() {
  const empty = COINS.filter((c) => db.stock[c].count === 0);
  const stuck = openIncidents().find((t) => ["jam", "hardware"].includes(t.incident));
  if (!db.machine.online) return { state: "offline", reason: "Machine is offline" };
  if (stuck) return { state: "paused", reason: "Service required", service: true, ref: stuck.ref };
  if (empty.length) return { state: "paused", reason: `₱${empty[0]} hopper empty`, coin: empty[0] };
  return { state: "running", reason: "Taking exchanges" };
}

// ---- Auth (Supabase) ----
async function loadAdmin(authUser) {
  const { data, error } = await supabase.from("admins").select("name, role").eq("id", authUser.id).maybeSingle();
  if (error) throw new Error("Couldn't check your account. Try again.");
  if (!data) return null;
  db.user = { name: data.name, email: authUser.email, role: data.role };
  return db.user;
}

/** Signs in and returns the admin, or throws a message for the sign-in screen. */
export async function signIn(email, password) {
  if (!configured) throw new Error("The dashboard isn't connected yet. Add your Supabase details to .env.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.status === 400
      ? "Wrong email or password."
      : "Couldn't reach the server. Check your connection and try again.");
  }
  const admin = await loadAdmin(data.user);
  if (!admin) {
    await supabase.auth.signOut();
    throw new Error("This account isn't on the admin list yet. Ask a D' MARBY admin to add you.");
  }
  return admin;
}

/** The admin from a saved session (page refresh), or null. */
export async function currentUser() {
  if (!configured) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try {
    return await loadAdmin(data.session.user);
  } catch {
    return null;
  }
}

/** Runs onSignedOut when the session ends (sign-out in another tab, expired login). */
export function watchSignOut(onSignedOut) {
  if (!configured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") onSignedOut();
  });
  return () => data.subscription.unsubscribe();
}

export async function signOut() {
  db.user = null;
  if (configured) await supabase.auth.signOut();
}

// ---- Reads ----
const EXCHANGES = ["bill", "break", "combine"];

export async function getOverview() {
  await wait();
  const tx = txs();
  const cashIns = tx.filter((t) => t.type === "gcash");
  const hourly = Array(10).fill(0); // 8 AM to 5 PM
  for (const t of tx) {
    const h = new Date(t.time).getHours() - 8;
    if (h >= 0 && h < hourly.length) hourly[h] += 1;
  }
  return {
    machine: { ...db.machine, ...machineState() },
    stock: structuredClone(db.stock),
    gcashFloat: { ...db.gcashFloat },
    kpis: {
      exchanges: tx.filter((t) => EXCHANGES.includes(t.type)).length,
      exchangesDelta: 8,
      cashIns: cashIns.length,
      cashInTotal: cashIns.reduce((s, t) => s + t.amount, 0),
      fees: cashIns.reduce((s, t) => s + (t.fee || 0), 0),
    },
    hourly,
    gcashPending: pendingGcash().length,
    gcashPendingTotal: pendingGcash().reduce((s, t) => s + t.amount, 0),
    incidentsOpen: openIncidents().length,
  };
}

export async function getTransactions({ type = "all", range = "today" } = {}) {
  await wait();
  const all = txs();
  let list = all;
  if (type === "exchange") list = all.filter((t) => EXCHANGES.includes(t.type));
  else if (type !== "all") list = all.filter((t) => t.type === type);
  // range is accepted for the real API; the sample data is all "today".
  return {
    items: list,
    summary: { count: all.length, handled: all.reduce((s, t) => s + (t.type === "incident" ? 0 : t.amount), 0) },
    range,
  };
}

export async function getStock() {
  await wait();
  return {
    stock: structuredClone(db.stock),
    lastCount: structuredClone(db.lastCount),
    cashBox: cashBoxTotals(),
    activity: db.activity.map((a) => ({ ...a })),
  };
}

export async function getGcashFloat() {
  await wait();
  return { ...db.gcashFloat };
}

/** Cash-in requests from the kiosk. Staff send the money manually, then mark them sent. */
export async function getGcashRequests() {
  await wait();
  const list = txs().filter((t) => t.type === "gcash");
  return {
    pending: list.filter((t) => t.gcashStatus === "pending").reverse(), // oldest first: send in order
    sent: list.filter((t) => t.gcashStatus === "sent"),
    float: { ...db.gcashFloat },
  };
}

export async function getIncidents() {
  await wait();
  const list = txs().filter((t) => t.type === "incident");
  return { open: list.filter((t) => !t.resolved), resolved: list.filter((t) => t.resolved) };
}

export async function getUsers() {
  await wait();
  return db.users.map((u) => ({ ...u }));
}

export async function getSettings() {
  await wait();
  return { ...db.settings };
}

// ---- Writes ----
const who = () => db.user?.name || "Staff";
const log = (kind, text) =>
  db.activity.unshift({ id: `A-${Date.now()}`, kind, text, who: who(), time: new Date().toISOString() });

export async function recordRefill(coin, coins) {
  await wait();
  db.stock[coin].count += coins;
  db.lastCount[coin] = null; // hopper changed, so it needs a fresh count
  log("refill", `Refill ₱${coin} +${coins} coins`);
}

export async function collectCash(amount) {
  await wait();
  log("cash", `Collected ₱${amount.toLocaleString()}`);
  db.cashBox = { since: new Date().toISOString() };
}

export async function saveCount(counts) {
  await wait();
  for (const c of COINS) db.lastCount[c] = { counted: counts[c], expected: db.stock[c].count };
  log("count", "Stock counted");
}

export async function topUpFloat(amount) {
  await wait();
  db.gcashFloat.balance += amount;
  log("gcash", `GCash float topped up +₱${amount.toLocaleString()}`);
}

/** After sending the money from the team's GCash app. */
export async function markGcashSent(ref) {
  await wait();
  const r = rows.find((x) => x.number === ref);
  if (!r || r.status !== "pending") throw new Error("This request was already handled.");
  r.status = "sent";
  r.sent_at = new Date().toISOString();
  r.sent_by = who();
  db.gcashFloat.balance -= r.details.amount;
  log("gcash", `Sent ₱${r.details.amount} to GCash (Ref ${ref})`);
}

/** Customer was paid back or the issue was otherwise settled. */
export async function resolveIncident(ref, note = "") {
  await wait();
  const r = rows.find((x) => x.number === ref);
  if (!r) throw new Error("Incident not found.");
  r.resolved_at = new Date().toISOString();
  r.resolved_by = who();
  r.resolution_note = note;
  log("incident", `Resolved incident ${ref}${note ? `: ${note}` : ""}`);
}

export async function saveSettings(next) {
  await wait();
  db.settings = { ...db.settings, ...next };
}
