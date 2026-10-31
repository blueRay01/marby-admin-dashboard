// All data the admin site shows comes through this file.
// Right now it returns sample data kept in memory. When the kiosk backend is
// ready, replace each function body with a fetch() to the real endpoint and
// keep the same return shapes, so no page has to change.

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export const COINS = [20, 10, 5, 1];

const today = new Date();
const at = (h, m) => {
  const d = new Date(today);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const db = {
  user: null,
  machine: {
    name: "Machine 01",
    location: "Main Lobby",
    online: true,
    lastSeenSeconds: 12,
  },
  // count = coins in the hopper now, capacity = full hopper
  stock: {
    20: { count: 38, capacity: 60 },
    10: { count: 54, capacity: 80 },
    5: { count: 0, capacity: 100 },
    1: { count: 31, capacity: 200 },
  },
  gcashFloat: { balance: 1850, target: 3000 },
  cashBox: { since: at(6, 2), bills: 2870, coins: 1214 },
  // last physical count per hopper, with what the machine expected at that moment
  lastCount: { 20: { counted: 38, expected: 38 }, 10: { counted: 52, expected: 54 }, 5: { counted: 0, expected: 0 }, 1: null },
  transactions: [
    { id: "T-1041", type: "bill", time: at(14, 41), amount: 50, detail: "₱50 bill, 17 coins" },
    { id: "T-1040", type: "gcash", time: at(14, 33), amount: 200, fee: 10, detail: "0917 *** 4567" },
    { id: "T-1039", type: "combine", time: at(14, 20), amount: 10, detail: "6 coins into 1 × ₱10" },
    { id: "T-1038", type: "kept", time: at(14, 5), amount: 7, detail: "Customer walked away", reviewed: false },
    { id: "T-1037", type: "break", time: at(13, 52), amount: 20, detail: "₱20 into ₱10 + 10 × ₱1" },
    { id: "T-1036", type: "bill", time: at(13, 48), amount: 20, detail: "₱20 bill, 11 coins" },
    { id: "T-1035", type: "gcash", time: at(13, 30), amount: 100, fee: 5, detail: "0928 *** 1102" },
    { id: "T-1034", type: "bill", time: at(13, 12), amount: 100, detail: "₱100 bill, 9 coins" },
    { id: "T-1033", type: "break", time: at(12, 58), amount: 10, detail: "₱10 into 2 × ₱5" },
    { id: "T-1032", type: "gcash", time: at(12, 41), amount: 500, fee: 25, detail: "0995 *** 3310" },
    { id: "T-1031", type: "combine", time: at(12, 15), amount: 20, detail: "4 coins into 1 × ₱20" },
    { id: "T-1030", type: "bill", time: at(11, 47), amount: 50, detail: "₱50 bill, 10 coins" },
    { id: "T-1029", type: "kept", time: at(11, 20), amount: 3, detail: "Customer walked away", reviewed: true },
    { id: "T-1028", type: "bill", time: at(10, 33), amount: 20, detail: "₱20 bill, 4 coins" },
  ],
  hourly: [2, 4, 3, 6, 5, 11, 8, 7, 4, 3], // 8 AM to 5 PM
  activity: [
    { id: "A-3", kind: "refill", text: "Refill ₱5 +100 coins", who: "Mara D.", time: at(9, 10) },
    { id: "A-2", kind: "cash", text: "Collected ₱3,500", who: "Jun R.", time: at(6, 2) },
  ],
  users: [
    { name: "Mara D.", email: "mara@dmarby.ph", role: "Admin" },
    { name: "Jun R.", email: "jun@dmarby.ph", role: "Staff" },
    { name: "Klydel S.", email: "klydel@dmarby.ph", role: "Staff" },
  ],
  settings: { contactNumber: "09XX XXX XXXX", gcashFeePercent: 5, lowStockPercent: 25 },
};

// ---- Status helpers (shared by pages) ----
export function coinStatus({ count, capacity }, lowPercent = db.settings.lowStockPercent) {
  if (count === 0) return "empty";
  if (count / capacity < lowPercent / 100) return "low";
  return "good";
}

export function machineState() {
  const empty = COINS.filter((c) => db.stock[c].count === 0);
  if (!db.machine.online) return { state: "offline", reason: "Machine is offline" };
  if (empty.length) return { state: "paused", reason: `₱${empty[0]} hopper empty`, coin: empty[0] };
  return { state: "running", reason: "Taking exchanges" };
}

// ---- Auth ----
export async function signIn(email, password) {
  await wait();
  if (!email.includes("@") || password.length < 4) {
    throw new Error("Check your email and password, then try again.");
  }
  return { needsCode: true, email };
}

export async function verifyCode(email, code) {
  await wait();
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code from your authenticator app.");
  const user = db.users.find((u) => u.email === email) || { name: email.split("@")[0], email, role: "Staff" };
  db.user = user;
  return user;
}

export async function signOut() {
  db.user = null;
}

// ---- Reads ----
export async function getOverview() {
  await wait();
  const tx = db.transactions;
  const exchanges = tx.filter((t) => ["bill", "break", "combine"].includes(t.type)).length;
  const cashIns = tx.filter((t) => t.type === "gcash");
  return {
    machine: { ...db.machine, ...machineState() },
    stock: structuredClone(db.stock),
    gcashFloat: { ...db.gcashFloat },
    kpis: {
      exchanges,
      exchangesDelta: 8,
      cashIns: cashIns.length,
      cashInTotal: cashIns.reduce((s, t) => s + t.amount, 0),
      fees: cashIns.reduce((s, t) => s + (t.fee || 0), 0),
    },
    hourly: [...db.hourly],
    keptToReview: tx.filter((t) => t.type === "kept" && !t.reviewed).length,
  };
}

export async function getTransactions({ type = "all", range = "today" } = {}) {
  await wait();
  let list = db.transactions;
  if (type === "exchange") list = list.filter((t) => ["bill", "break", "combine"].includes(t.type));
  else if (type !== "all") list = list.filter((t) => t.type === type);
  // range is accepted for the real API; the sample data is all "today".
  const all = db.transactions;
  return {
    items: list.map((t) => ({ ...t })),
    summary: { count: all.length, handled: all.reduce((s, t) => s + t.amount, 0) },
    range,
  };
}

export async function getStock() {
  await wait();
  return {
    stock: structuredClone(db.stock),
    lastCount: structuredClone(db.lastCount),
    cashBox: { ...db.cashBox },
    activity: db.activity.map((a) => ({ ...a })),
  };
}

export async function getGcashFloat() {
  await wait();
  return { ...db.gcashFloat };
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
export async function recordRefill(coin, coins) {
  await wait();
  db.stock[coin].count += coins;
  db.lastCount[coin] = null; // hopper changed, so it needs a fresh count
  db.activity.unshift({
    id: `A-${Date.now()}`, kind: "refill", text: `Refill ₱${coin} +${coins} coins`,
    who: db.user?.name || "Staff", time: new Date().toISOString(),
  });
}

export async function collectCash(amount) {
  await wait();
  db.activity.unshift({
    id: `A-${Date.now()}`, kind: "cash", text: `Collected ₱${amount.toLocaleString()}`,
    who: db.user?.name || "Staff", time: new Date().toISOString(),
  });
  db.cashBox = { since: new Date().toISOString(), bills: 0, coins: 0 };
}

export async function saveCount(counts) {
  await wait();
  for (const c of COINS) db.lastCount[c] = { counted: counts[c], expected: db.stock[c].count };
  db.activity.unshift({
    id: `A-${Date.now()}`, kind: "count", text: "Stock counted",
    who: db.user?.name || "Staff", time: new Date().toISOString(),
  });
}

export async function topUpFloat(amount) {
  await wait();
  db.gcashFloat.balance += amount;
}

export async function markKeptReviewed(id) {
  await wait();
  const t = db.transactions.find((x) => x.id === id);
  if (t) t.reviewed = true;
}

export async function saveSettings(next) {
  await wait();
  db.settings = { ...db.settings, ...next };
}
