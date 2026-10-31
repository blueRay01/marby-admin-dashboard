# D' MARBY Admin

Mobile-first admin site for the D' MARBY coin exchanger (React + Vite).
Works on phones first, and switches to a sidebar layout on screens 960px and wider.

## Run it
You need Node.js 18 or newer.

    npm install
    npm run dev

The terminal shows two addresses. `Local` opens on your computer. `Network`
(for example http://192.168.1.20:5173) opens on your phone, as long as it's on
the same Wi-Fi.

Sample sign-in: any email and password (try `mara@dmarby.ph` for the Admin role),
then any 6 digits as the code.

## Build for hosting

    npm run build      # outputs to dist/
    npm run preview    # check the built version

## Where things are
- `src/api.js`: every piece of data the site reads or writes. It uses sample data now.
  When the kiosk backend has endpoints, replace each function's body with a `fetch()`
  and keep the same return shape. No page needs to change.
- `src/pages/`: Dashboard, Transactions, Stock, SignIn, and `More.jsx` (Cash box,
  GCash float, Kept money, Alerts, Settings, Users and roles, Audit log).
- `src/components/`: the menu/sidebar shell and small shared pieces.
- `src/styles.css`: all styling. Colours are variables at the top.

## Colour rules
- Blue: normal (Good, Online, refills).
- Amber: worth a look (Low stock, kept money to review, tips).
- Red: only when the machine is blocked (paused, empty hopper, stock count mismatch).
