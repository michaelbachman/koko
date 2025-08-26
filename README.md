# NKO — BTCUSDT Perpetual Tracker

A minimal, mobile‑first dark UI that shows the next funding time (local tz), a large countdown, and live mark price for **BTCUSDT** using Binance Futures.

---

## 🚀 One‑click Deploy

> First push these files to a **new GitHub repo** (public or private). Replace `https://github.com/michaelbachman/koko.git` below with your repo URL.

### Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/michaelbachman/koko.git)

### Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/michaelbachman/koko.git)

---

## 📦 What’s inside

- `index.html` — UI (dark theme, 8px dot grid, responsive type)
- `nko-binance.js` — ES module with Binance WebSocket + REST, UTC roll‑forward, local timestamp formatting
- `netlify.toml` — security headers + CSP
- `vercel.json` — security headers + CSP

**CSP** allows:`connect-src` → `https://fapi.binance.com` (REST) and `wss://fstream.binance.com` (WS)`style-src` → inline + `https://fonts.googleapis.com``font-src` → `https://fonts.gstatic.com`

---

## 🛠 Local dev

Any static server works:

```bash
# Python 3
python3 -m http.server 5173

# Node
npx http-server -p 5173
```

Open `http://localhost:5173`

---

## ☁️ CLI deploy (alternative)

### Vercel
```bash
npm i -g vercel
vercel --prod
```

### Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=.
```

> **Note:** No build step needed — this is a static site.

---

## 🔒 Notes

- This app **does not** buy, sell, or store crypto. It only displays funding and mark price information for **BTCUSDT PERP**.
- Funding timestamps are shown in **local time** (with zone label). Countdown rolls forward exactly at funding to avoid freezing at `00:00:00`.
