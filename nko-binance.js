// nko-binance.js
export default function initNKO(options = {}) {
  const {
    symbol = 'BTCUSDT',
    elements: {
      fundingTimeEl,
      hEl, mEl, sEl,
      statusDot, statusText,
      countdown,
      markPriceEl, symbolEl, quoteBadgeEl,
    } = {}
  } = options;

  let ws = null;
  let nextFundingMs = null;
  let currentQuote = null;
  let lastMarkPrice = null;

  const EIGHT_HOURS = 8 * 60 * 60 * 1000;

  const debug = (typeof URLSearchParams !== 'undefined' && new URLSearchParams(location.search).has('debug')) ||
                (typeof localStorage !== 'undefined' && localStorage.getItem('nko_debug') === '1');
  const log = (...args) => { if (debug) console.log('[NKO]', ...args); };

  function setStatus(connected) {
    if (!statusDot || !statusText || !countdown) return;
    statusDot.style.transition = 'none';
    statusText.style.transition = 'none';
    countdown.style.transition = 'none';
    statusDot.style.backgroundColor = connected ? '#bc13fe' : 'red';
    statusText.textContent = connected ? 'Live' : 'Disconnected';
    statusText.style.color = connected ? '#bc13fe' : 'red';
  }

  // Normalize timestamps to ms (guard against seconds)
  function toMs(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n)) return null;
    return n < 1e12 ? n * 1000 : n;
  }

  // Safe local formatter (no Intl)
  function fmtTimeLocal(ms) {
    const n = toMs(ms);
    if (!n) return '—';
    const d = new Date(n);
    if (isNaN(d)) return '—';
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h  = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const s  = String(d.getSeconds()).padStart(2, '0');
    let tz = '';
    try {
      const t = d.toString();
      const open = t.indexOf('(');
      const close = open !== -1 ? t.indexOf(')', open + 1) : -1;
      if (open !== -1 && close !== -1) {
        const full = t.slice(open + 1, close).trim();
        const parts = full.split(' ').filter(Boolean);
        tz = parts.map(w => w[0]).join('').toUpperCase();
      } else {
        const g = t.indexOf('GMT');
        if (g !== -1) tz = t.slice(g, g + 7).trim();
      }
    } catch {}
    return `${y}-${mo}-${da} ${h}:${mi}:${s}${tz ? ' ' + tz : ''}`;
  }

  function pad2(num) { return String(num).padStart(2, '0'); }

  function fmtPrice(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return '—';
    const s = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isUSDQuote = currentQuote && /^(USD|USDT|USDC|BUSD)$/.test(currentQuote);
    return (isUSDQuote ? '$' : '') + s;
  }

  function fmtSymbol(sym) {
    if (!sym) { currentQuote = null; return '—'; }
    const m = sym.match(/^(.*?)(USDT|BUSD|USDC|USD)$/);
    if (m) { currentQuote = m[2]; return `${m[1]}/${m[2]}`; }
    currentQuote = null; return sym;
  }

  function nextFundingBoundaryUTC(fromMs) {
    const n = toMs(fromMs ?? Date.now());
    return Math.ceil(n / EIGHT_HOURS) * EIGHT_HOURS;
  }

  function tickCountdown() {
    if (!nextFundingMs) { if (hEl) hEl.textContent = '—'; if (mEl) mEl.textContent = '—'; if (sEl) sEl.textContent = '—'; return; }
    const now = Date.now();
    let diff = nextFundingMs - now;
    if (diff <= 0) {
      nextFundingMs = nextFundingBoundaryUTC(now);
      if (fundingTimeEl) fundingTimeEl.textContent = fmtTimeLocal(nextFundingMs);
      refreshREST();
      diff = nextFundingMs - now;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (hEl) hEl.textContent = pad2(h);
    if (mEl) mEl.textContent = pad2(m);
    if (sEl) sEl.textContent = pad2(s);
  }

  let retry = 0;
  function nextDelay() {
    const base = Math.min(30000, 1000 * Math.pow(2, retry)); // 1s,2s,4s...max 30s
    const jitter = Math.random() * 300; // up to 300ms jitter
    return base + jitter;
  }

  function connect() {
    const url = `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@markPrice@1s`;
    try { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch {}
    log('WS connecting to', url);
    ws = new WebSocket(url);
    ws.onopen = () => { retry = 0; setStatus(true); log('WS open'); };
    ws.onmessage = (msg) => {
      try {
        const d = JSON.parse(msg.data);
        if (d.T !== undefined) {
          nextFundingMs = toMs(d.T);
          if (fundingTimeEl) fundingTimeEl.textContent = fmtTimeLocal(nextFundingMs);
        }
        if (d.s !== undefined) {
          const symText = fmtSymbol(d.s);
          if (symbolEl) symbolEl.textContent = symText;
          if (quoteBadgeEl) quoteBadgeEl.textContent = currentQuote || '—';
          if (lastMarkPrice != null && markPriceEl) { markPriceEl.textContent = fmtPrice(lastMarkPrice); }
        }
        if (d.p !== undefined) {
          lastMarkPrice = Number(d.p);
          if (markPriceEl) markPriceEl.textContent = fmtPrice(lastMarkPrice);
        }
      } catch (e) { console.warn('[NKO] WS parse error', e); }
    };
    ws.onerror = (ev) => { log('WS error', ev); };
    ws.onclose = (ev) => {
      setStatus(false);
      retry++;
      const delay = nextDelay();
      log(`WS closed (code=${ev.code} reason=${ev.reason || 'n/a'}) → retry in ${Math.round(delay)}ms`);
      setTimeout(connect, delay);
    };
  }

  async function refreshREST() {
    try {
      const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (j.nextFundingTime) { nextFundingMs = toMs(j.nextFundingTime); if (fundingTimeEl) fundingTimeEl.textContent = fmtTimeLocal(nextFundingMs); }
      if (j.symbol) {
        const symText = fmtSymbol(j.symbol);
        if (symbolEl) symbolEl.textContent = symText;
        if (quoteBadgeEl) quoteBadgeEl.textContent = currentQuote || '—';
        if (lastMarkPrice != null && markPriceEl) { markPriceEl.textContent = fmtPrice(lastMarkPrice); }
      }
      if (j.markPrice) { lastMarkPrice = Number(j.markPrice); if (markPriceEl) markPriceEl.textContent = fmtPrice(lastMarkPrice); }
    } catch (err) { console.warn('[NKO] REST refresh failed', err); }
  }

  // boot
  connect();
  refreshREST();
  const startDelay = 1000 - (Date.now() % 1000);
  setTimeout(() => {
    tickCountdown();
    setInterval(tickCountdown, 1000);
  }, startDelay);
  setInterval(refreshREST, 60_000);

  return {
    reconnect: connect,
    refresh: refreshREST,
    get state() { return { nextFundingMs, currentQuote, lastMarkPrice }; }
  };
}
