// All data the admin site shows comes through this file, live from Supabase.
// Rows in `transactions` are the kiosk's own records (number, created_at, mode,
// kind, status, details), synced by dmarby_sync.py on the Pi. toTx() turns one
// row into what the pages show. Writes go through database functions that check
// the signed-in admin (see supabase/setup.sql).

import { MACHINE_ID, configured, supabase } from "./supabase.js";

export const COINS = [20, 10, 5, 1];
const DEFAULT_CAPACITY = { 20: 60, 10: 80, 5: 100, 1: 200 };
const OFFLINE_AFTER_S = 180;          // no heartbeat for 3 minutes = offline
const GCASH_FEE_PERCENT = 3;          // set on the kiosk (dmarby.py GCASH_FEE_RATE)
const EXCHANGES = ["bill", "break", "combine"];

let currentAdmin = null;

// ---- Helpers ----

function fail(error, fallback = "Couldn't load data. Check your connection and try again.") {
  if (error) throw new Error(error.message || fallback);
}

const sumPlan = (plan = {}) => Object.entries(plan).reduce((s, [c, n]) => s + Number(c) * n, 0);
const coinsIn = (plan = {}) => Object.values(plan).reduce((s, n) => s + n, 0);
const masked = (n = "") => `${n.slice(0, 4)} *** ${n.slice(7)}`;
const describe = (plan = {}) =>
  Object.keys(plan).map(Number).sort((a, b) => b - a)
    .map((c) => (plan[c] === 1 ? `₱${c}` : `${plan[c]} × ₱${c}`)).join(" + ");

const FLOW_NAMES = { bill: "bill to coins", break: "break coins", combine: "combine coins", gcash: "GCash" };
const INCIDENT_TITLES = {
  jam: "Coins got stuck",
  hardware: "Service required",
  cant_change: "Couldn't give change",
  wrong_bill_unpayable: "Wrong bill, couldn't change",
  overpayment: "Overpaid",
  home_cancelled: "Customer left mid-exchange",
  timeout: "Customer left money",
};

function startOf(range) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "yesterday") d.setDate(d.getDate() - 1);
  if (range === "week") d.setDate(d.getDate() - 6);
  if (range === "month") d.setDate(1);
  return d;
}

function rangeBounds(range) {
  const from = startOf(range);
  const to = range === "yesterday" ? startOf("today") : null;
  return { from: from.toISOString(), to: to && to.toISOString() };
}

// Low-stock threshold is a dashboard preference, kept in this browser.
function lowStockPercent() {
  try {
    return Number(localStorage.getItem("dmarby-low-stock")) || 25;
  } catch {
    return 25;
  }
}

// ---- Kiosk row -> page item ----

/** Money still owed on a hardware incident: coins/bills taken in minus coins paid out. */
function owedFromJournal(d) {
  const received = (d.received || []).reduce((s, r) => s + (r.value || 0), 0) +
    (d.uncredited_inputs || []).reduce((s, r) => s + (r.value || 0), 0);
  return Math.max(0, (d.credit ?? received) - sumPlan(d.dispensed));
}

export function toTx(r) {
  const d = r.details || {};
  const base = { id: r.number, ref: r.number, time: r.created_at, mode: r.mode };
  if (r.status === "incident" || r.status === "forfeit") {
    const type = r.status === "forfeit" ? "timeout" : d.type || d.incident?.type || "hardware";
    const flow = d.flow;
    return {
      ...base, type: "incident", incident: type, title: INCIDENT_TITLES[type] || "Incident", info: d,
      amount: d.owed ?? (d.status ? owedFromJournal(d) : d.amount ?? 0),
      detail: flow ? `During ${FLOW_NAMES[flow] || flow}` : d.fault ? "Machine stopped" : "",
      resolved: Boolean(r.resolved_at), resolvedAt: r.resolved_at, resolvedBy: r.resolved_by,
      note: r.resolution_note,
    };
  }
  if (r.status === "refunded") {
    return { ...base, type: "refund", amount: d.amount, detail: `Coins returned: ${describe(d.plan)}` };
  }
  if (r.kind === "gcash") {
    return {
      ...base, type: "gcash", amount: d.amount, fee: d.fee, received: d.received,
      gcashNumber: d.number || "", gcashName: d.name || "",
      detail: d.number ? `${masked(d.number)}, ${d.name || ""}` : "",
      gcashStatus: r.status, sentAt: r.sent_at, sentBy: r.sent_by,
    };
  }
  const amount = d.amount ?? d.credit ?? 0;
  const plan = d.plan || {};
  const n = coinsIn(plan);
  const flow = d.flow || (d.source === "bill" ? "bill" : "break");
  const detail = flow === "bill" ? `₱${amount} bill, ${n} coin${n === 1 ? "" : "s"}` : `Gave ${describe(plan)}`;
  return { ...base, type: flow, amount, detail };
}

/** Bills and coins a transaction put into the cash box. */
function cashIn(r) {
  const d = r.details || {};
  let bills = 0, coins = 0;
  const add = (src, v) => (src === "bill" ? (bills += v) : (coins += v));
  if (Array.isArray(d.received)) d.received.forEach((x) => add(x.source, x.value || 0));
  else if (Array.isArray(d.inserted)) d.inserted.forEach(([src, v]) => add(src, v || 0));
  else if (r.kind === "gcash" && r.status !== "refunded") coins += d.received || 0;
  else if (r.status === "refunded") coins += d.amount || 0;
  else if (d.flow === "bill") bills += d.amount || 0;
  else coins += d.amount || 0;
  return { bills, coins };
}

// ---- Queries ----

async function getMachine() {
  const { data, error } = await supabase.from("machines").select("*").eq("id", MACHINE_ID).maybeSingle();
  fail(error);
  if (!data) throw new Error(`Machine "${MACHINE_ID}" isn't set up in Supabase yet.`);
  return data;
}

async function rows(query) {
  const { data, error } = await query;
  fail(error);
  return data || [];
}

const transactions = () =>
  supabase.from("transactions").select("*").eq("machine_id", MACHINE_ID).neq("status", "open");

function stockOf(machine) {
  const inv = machine.inventory || {}, cap = machine.capacity || {};
  return Object.fromEntries(COINS.map((c) => [c, {
    count: Number(inv[c] ?? 0),
    capacity: Number(cap[c] ?? DEFAULT_CAPACITY[c]),
  }]));
}

function machineInfo(machine, stock, open) {
  const lastSeenSeconds = machine.last_seen
    ? Math.max(0, Math.round((Date.now() - new Date(machine.last_seen)) / 1000)) : null;
  const online = lastSeenSeconds != null && lastSeenSeconds < OFFLINE_AFTER_S;
  const base = { name: machine.name, location: machine.location, online, lastSeenSeconds, mode: machine.mode };
  const empty = COINS.filter((c) => stock[c].count === 0);
  // The kiosk keeps going after a failure, so only an error showing right now pauses it.
  if (!online) return { ...base, state: "offline", reason: lastSeenSeconds == null ? "Never connected" : "Machine is offline" };
  if (machine.journal_status === "fault") {
    return { ...base, state: "paused", reason: "Showing an error", service: true, ref: open[0]?.ref || "" };
  }
  if (empty.length) return { ...base, state: "paused", reason: `₱${empty[0]} hopper empty`, coin: empty[0] };
  return { ...base, state: "running", reason: "Taking exchanges" };
}

export function coinStatus({ count, capacity }, lowPercent = lowStockPercent()) {
  if (count === 0) return "empty";
  if (count / capacity < lowPercent / 100) return "low";
  return "good";
}

async function openIncidents() {
  return (await rows(transactions().in("status", ["incident", "forfeit"]).is("resolved_at", null)
    .order("created_at", { ascending: false }))).map(toTx);
}

async function pendingGcash() {
  return (await rows(transactions().eq("kind", "gcash").eq("status", "pending")
    .order("created_at", { ascending: true }))).map(toTx);
}

// ---- Auth (Supabase) ----

async function loadAdmin(authUser) {
  const { data, error } = await supabase.from("admins").select("name, role").eq("id", authUser.id).maybeSingle();
  if (error) throw new Error("Couldn't check your account. Try again.");
  if (!data) return null;
  currentAdmin = { name: data.name, email: authUser.email, role: data.role };
  return currentAdmin;
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
  currentAdmin = null;
  if (configured) await supabase.auth.signOut();
}

// ---- Reads ----

export async function getOverview() {
  const today = rangeBounds("today").from;
  const yesterday = rangeBounds("yesterday");
  const [machine, todayRows, yesterdayExchanges, open, pending] = await Promise.all([
    getMachine(),
    rows(transactions().gte("created_at", today)),
    supabase.from("transactions").select("number", { count: "exact", head: true })
      .eq("machine_id", MACHINE_ID).eq("kind", "cash").eq("status", "completed")
      .gte("created_at", yesterday.from).lt("created_at", yesterday.to)
      .then(({ count, error }) => { fail(error); return count || 0; }),
    openIncidents(),
    pendingGcash(),
  ]);
  const tx = todayRows.map(toTx);
  const cashIns = tx.filter((t) => t.type === "gcash");
  const exchanges = tx.filter((t) => EXCHANGES.includes(t.type)).length;
  const hourly = Array(10).fill(0); // 8 AM to 5 PM
  for (const t of tx) {
    const h = new Date(t.time).getHours() - 8;
    if (h >= 0 && h < hourly.length) hourly[h] += 1;
  }
  const stock = stockOf(machine);
  return {
    machine: machineInfo(machine, stock, open),
    stock,
    gcashFloat: { balance: machine.gcash_balance, target: machine.gcash_target },
    kpis: {
      exchanges,
      exchangesDelta: exchanges - yesterdayExchanges,
      cashIns: cashIns.length,
      cashInTotal: cashIns.reduce((s, t) => s + (t.amount || 0), 0),
      fees: cashIns.reduce((s, t) => s + (t.fee || 0), 0),
    },
    hourly,
    gcashPending: pending.length,
    gcashPendingTotal: pending.reduce((s, t) => s + (t.amount || 0), 0),
    incidentsOpen: open.length,
  };
}

export async function getTransactions({ type = "all", range = "today" } = {}) {
  const { from, to } = rangeBounds(range);
  let q = transactions().gte("created_at", from).order("created_at", { ascending: false }).limit(1000);
  if (to) q = q.lt("created_at", to);
  const all = (await rows(q)).map(toTx);
  let items = all;
  if (type === "exchange") items = all.filter((t) => EXCHANGES.includes(t.type));
  else if (type !== "all") items = all.filter((t) => t.type === type);
  return {
    items,
    summary: { count: all.length, handled: all.reduce((s, t) => s + (t.type === "incident" ? 0 : t.amount || 0), 0) },
    range,
  };
}

export async function getStock() {
  const machine = await getMachine();
  const [since, activity, pending] = await Promise.all([
    rows(transactions().gte("created_at", machine.cash_collected_at).limit(5000)),
    rows(supabase.from("activity").select("*").eq("machine_id", MACHINE_ID)
      .order("created_at", { ascending: false }).limit(100)),
    rows(supabase.from("stock_adjustments").select("*").eq("machine_id", MACHINE_ID)
      .eq("status", "pending").order("id")),
  ]);
  const box = since.reduce((t, r) => {
    const c = cashIn(r);
    return { bills: t.bills + c.bills, coins: t.coins + c.coins };
  }, { bills: 0, coins: 0 });
  return {
    stock: stockOf(machine),
    lastSeen: machine.last_seen,
    cashBox: { since: machine.cash_collected_at, ...box },
    activity: activity.map((a) => ({ id: a.id, kind: a.kind, text: a.text, who: a.who, time: a.created_at })),
    pending: pending.map((a) => ({ id: a.id, coin: a.coin, kind: a.kind, amount: a.amount,
                                   who: a.requested_by, time: a.requested_at })),
  };
}

export async function getGcashFloat() {
  const machine = await getMachine();
  return { balance: machine.gcash_balance, target: machine.gcash_target };
}

/** Cash-in requests from the kiosk. Staff send the money manually, then mark them sent. */
// The kiosk timestamps are Philippine-local; calculate the same day in UTC for Supabase.
function manilaDayBounds() {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const start = new Date(`${today}T00:00:00+08:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}

export async function getGcashDailyCount() {
  const {start,end} = manilaDayBounds();
  const {count,error} = await transactions().select('number',{count:'exact',head:true})
    .eq('kind','gcash').in('status',['pending','sent','completed'])
    .gte('created_at',start).lt('created_at',end);
  fail(error);
  return {count: count ?? 0,limit:5};
}

export async function getGcashRequests() {
  const [machine, pending, sent, daily] = await Promise.all([
    getMachine(),
    pendingGcash(),
    rows(transactions().eq("kind", "gcash").eq("status", "sent")
      .order("sent_at", { ascending: false }).limit(50)),
    getGcashDailyCount(),
  ]);
  return {
    daily,
    pending,   // oldest first: send in order
    sent: sent.map(toTx),
    float: { balance: machine.gcash_balance, target: machine.gcash_target },
  };
}

export async function getIncidents() {
  const [open, resolved] = await Promise.all([
    openIncidents(),
    rows(transactions().in("status", ["incident", "forfeit"]).not("resolved_at", "is", null)
      .order("resolved_at", { ascending: false }).limit(50)),
  ]);
  return { open, resolved: resolved.map(toTx) };
}

export async function getUsers() {
  return rows(supabase.from("admins").select("name, role").order("name"));
}

export async function getSettings() {
  return { gcashFeePercent: GCASH_FEE_PERCENT, lowStockPercent: lowStockPercent() };
}

// ---- Writes (database functions record who did it) ----

async function call(fn, args) {
  const { error } = await supabase.rpc(fn, { p_machine: MACHINE_ID, ...args });
  fail(error, "That didn't go through. Try again.");
}

/** After sending the money from the team's GCash app. */
export const markGcashSent = (ref) => call("mark_gcash_sent", { p_number: ref });

/** Customer was paid back or the issue was otherwise settled. */
export const resolveIncident = (ref, note = "") => call("resolve_incident", { p_number: ref, p_note: note });

export const topUpFloat = (amount) => call("top_up_float", { p_amount: amount });

/** Set the absolute GCash balance (not a top-up). Requires the SQL RPC migration. */
export const setGcashFloat = (amount) => call("set_gcash_float", { p_balance: amount });

export const collectCash = (amount) => call("collect_cash", { p_amount: amount });

/** Queue coins added to a hopper. The kiosk applies it between transactions. */
export const recordRefill = (coin, coins) =>
  call("request_stock_adjustment", { p_coin: coin, p_kind: "refill", p_amount: coins });

/** Queue a physical count for each coin given ({20: 37, 5: 98}). */
export async function saveCount(counts) {
  for (const [coin, n] of Object.entries(counts)) {
    await call("request_stock_adjustment", { p_coin: Number(coin), p_kind: "count", p_amount: n });
  }
}

export const cancelAdjustment = (id) => call("cancel_stock_adjustment", { p_id: id });

export async function saveSettings(next) {
  try {
    localStorage.setItem("dmarby-low-stock", String(Number(next.lowStockPercent) || 25));
  } catch {
    // Private browsing: keep the default.
  }
}
