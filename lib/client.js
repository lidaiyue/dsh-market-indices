window.__ModuleLoader__.load({
  id: "dsh-market-indices",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    let React = require("react");
    if (React === null || typeof React !== "object") throw new Error("dsh-market-indices: react is unavailable");
    if (React.useState === undefined && React.default !== undefined && typeof React.default === "object") React = React.default;

    const STATUS_PATH = "/plugins/dsh-market-indices/status";
    const RESOLVE_PATH = "/plugins/dsh-market-indices/resolve";
    const REFRESH_MS = 15_000;
    const ROTATE_MS = 3_000;
    const WATCH_KEY = "dsh-market-indices:watchlist";
    const LEGACY_DISPLAY_KEY = "dsh-market-indices:display";
    const REFRESH_KEY = "dsh-market-indices:auto-refresh";
    const QUOTE_PAGE = "https://quote.eastmoney.com/unify/r/";
    const DEFAULT_WATCHLIST = [
      { id: "shanghai", secid: "1.000001", code: "000001", name: "上证指数", shortName: "上证", digits: 2, tencent: "sh000001" },
      { id: "chinext", secid: "0.399006", code: "399006", name: "创业板指", shortName: "创业", digits: 2, tencent: "sz399006" },
      { id: "hang-seng", secid: "100.HSI", code: "HSI", name: "恒生指数", shortName: "恒生", digits: 2, tencent: "hkHSI" },
      { id: "nasdaq", secid: "100.NDX", code: "NDX", name: "纳斯达克", shortName: "纳指", digits: 2, tencent: "us.IXIC" },
      { id: "sp500", secid: "100.SPX", code: "SPX", name: "标普500", shortName: "标普", digits: 2, tencent: "us.INX" },
    ];
    const CSS = [
      ".dsh-market-indices { display:inline-flex; align-items:center; min-width:0; }",
      ".dsh-market-hover { position:relative; display:inline-flex; align-items:center; }",
      ".dsh-market-ticker { box-sizing:border-box; display:flex; align-items:center; justify-content:center; width:112px; margin:0; padding:4px 6px; border:1px solid var(--dsw-alias-border-l2); border-radius:7px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; font-weight:600; line-height:16px; text-align:center; cursor:pointer; position:relative; z-index:1; transition:background-color .12s, border-color .12s, transform .08s, opacity .12s; }",
      ".dsh-market-ticker:hover { z-index:2; background:var(--dsw-alias-interactive-bg-hover); }",
      ".dsh-market-ticker:active { transform:translateY(1px); background:var(--dsw-alias-bg-layer-2); }",
      ".dsh-market-ticker:focus-visible { z-index:2; outline:2px solid var(--dsw-alias-brand-primary); outline-offset:1px; }",
      ".dsh-market-ticker[data-busy=true] { opacity:.72; cursor:progress; }",
      ".dsh-market-ticker[data-busy=true]:active { transform:none; }",
      ".dsh-market-ticker-text { display:flex; align-items:center; justify-content:center; gap:4px; width:100%; min-width:0; overflow:hidden; white-space:nowrap; font-variant-numeric:tabular-nums; }",
      ".dsh-market-ticker-name { color:var(--dsw-alias-label-secondary); font-weight:500; min-width:0; overflow:hidden; text-overflow:ellipsis; }",
      ".dsh-market-ticker-value { flex:none; font-weight:600; }",
      ".dsh-market-ticker[data-trend=up] .dsh-market-ticker-value { color:var(--dsw-alias-state-error-primary, #e34b4b); }",
      ".dsh-market-ticker[data-trend=down] .dsh-market-ticker-value { color:var(--dsw-alias-state-success-primary, #159957); }",
      ".dsh-market-ticker-muted { color:var(--dsw-alias-label-secondary); font-weight:500; }",

      ".dsh-market-panel { display:none; position:absolute; top:calc(100% + 6px); right:0; z-index:50; width:320px; padding:6px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-1); box-shadow:0 4px 16px rgba(0,0,0,.18); color:var(--dsw-alias-label-primary); }",
      ".dsh-market-panel::before { content:''; position:absolute; left:0; right:0; top:-7px; height:8px; }",
      ".dsh-market-hover:hover .dsh-market-panel, .dsh-market-hover:focus-within .dsh-market-panel, .dsh-market-panel:hover, .dsh-market-hover[data-pinned=true] .dsh-market-panel { display:block; }",
      ".dsh-market-list { display:flex; flex-direction:column; gap:1px; }",
      ".dsh-market-empty { padding:8px 6px; color:var(--dsw-alias-label-secondary); font-size:11px; line-height:16px; text-align:center; }",
      ".dsh-market-row { display:grid; grid-template-columns:12px minmax(0,1fr) auto auto 22px 16px; align-items:center; gap:6px; min-height:24px; padding:2px; border-radius:5px; font-size:12px; line-height:16px; cursor:grab; }",
      ".dsh-market-row:hover { background:var(--dsw-alias-interactive-bg-hover); }",
      ".dsh-market-row[data-dragging=true] { opacity:.55; cursor:grabbing; }",
      ".dsh-market-handle { display:flex; align-items:center; justify-content:center; width:12px; height:16px; color:var(--dsw-alias-label-secondary); font-size:11px; line-height:16px; letter-spacing:-1px; user-select:none; cursor:grab; }",
      ".dsh-market-rotate { box-sizing:border-box; display:inline-block; position:relative; width:22px; height:14px; padding:0; border:0; border-radius:7px; background:var(--dsw-alias-border-l2); cursor:pointer; }",
      ".dsh-market-rotate::after { content:''; position:absolute; top:2px; left:2px; width:10px; height:10px; border-radius:50%; background:var(--dsw-alias-bg-layer-1); transition:transform .12s; }",
      ".dsh-market-rotate[aria-pressed=true] { background:var(--dsw-alias-brand-primary, #3b82f6); }",
      ".dsh-market-rotate[aria-pressed=true]::after { transform:translateX(8px); }",
      ".dsh-market-autorefresh[aria-pressed=true] .dsh-market-rotate { background:var(--dsw-alias-brand-primary, #3b82f6); }",
      ".dsh-market-autorefresh[aria-pressed=true] .dsh-market-rotate::after { transform:translateX(8px); }",

      ".dsh-market-row-name { display:flex; align-items:baseline; gap:6px; min-width:0; overflow:hidden; white-space:nowrap; color:inherit; text-decoration:none; }",
      ".dsh-market-row-name:hover .dsh-market-row-name-text { text-decoration:underline; }",
      ".dsh-market-row-name-text { min-width:0; overflow:hidden; text-overflow:ellipsis; }",
      ".dsh-market-row-code { flex:none; color:var(--dsw-alias-label-secondary); font-size:11px; font-variant-numeric:tabular-nums; }",
      ".dsh-market-row-price { font-variant-numeric:tabular-nums; color:var(--dsw-alias-label-secondary); white-space:nowrap; }",
      ".dsh-market-row-change { font-variant-numeric:tabular-nums; font-weight:600; text-align:right; white-space:nowrap; min-width:4.25em; }",
      ".dsh-market-row[data-trend=up] .dsh-market-row-change { color:var(--dsw-alias-state-error-primary, #e34b4b); }",
      ".dsh-market-row[data-trend=down] .dsh-market-row-change { color:var(--dsw-alias-state-success-primary, #159957); }",
      ".dsh-market-row-muted { color:var(--dsw-alias-label-secondary); font-weight:500; }",
      ".dsh-market-remove { width:16px; height:16px; padding:0; border:0; border-radius:4px; background:transparent; color:var(--dsw-alias-label-secondary); font-size:14px; line-height:16px; cursor:pointer; }",
      ".dsh-market-remove:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }",

      ".dsh-market-source { box-sizing:border-box; flex:none; min-width:34px; padding:0 4px; border-radius:4px; color:var(--dsw-alias-label-secondary); font-size:10px; line-height:16px; letter-spacing:.02em; text-align:center; white-space:nowrap; font-variant-numeric:tabular-nums; }",
      ".dsh-market-source[data-source=tencent] { background:var(--dsw-alias-interactive-bg-hover); }",
      ".dsh-market-add { display:flex; align-items:center; gap:6px; margin-top:4px; padding:6px 2px 2px; border-top:1px solid var(--dsw-alias-border-l2); }",
      ".dsh-market-add-input { box-sizing:border-box; flex:1; min-width:0; height:24px; margin:0; padding:0 8px; border:1px solid var(--dsw-alias-border-l2); border-radius:5px; background:transparent; color:inherit; font:inherit; font-size:12px; line-height:22px; }",
      ".dsh-market-add-input:focus { outline:1px solid var(--dsw-alias-brand-primary); outline-offset:0; }",
      ".dsh-market-add-btn { box-sizing:border-box; flex:none; height:24px; margin:0; padding:0 8px; border:1px solid var(--dsw-alias-border-l2); border-radius:5px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; line-height:22px; cursor:pointer; }",
      ".dsh-market-add-btn:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-interactive-bg-hover); }",
      ".dsh-market-add-btn:disabled { opacity:.55; cursor:progress; }",
      ".dsh-market-autorefresh { display:flex; align-items:center; gap:4px; flex:none; margin:0; padding:0; border:0; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; cursor:pointer; }",
      ".dsh-market-autorefresh-label { font-size:11px; line-height:16px; white-space:nowrap; }",
      ".dsh-market-autorefresh:hover { color:var(--dsw-alias-label-primary); }",
      ".dsh-market-hint { padding:2px 6px 0; font-size:11px; line-height:16px; color:var(--dsw-alias-label-secondary); }",
      ".dsh-market-hint[data-kind=error] { color:var(--dsw-alias-state-error-primary); }",
      ".dsh-market-hint[data-kind=source] { color:var(--dsw-alias-label-secondary); font-style:italic; }",
      ".dsh-market-matches { display:flex; flex-direction:column; gap:1px; margin-top:4px; }",
      ".dsh-market-match { display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; min-height:24px; margin:0; padding:2px 6px; border:0; border-radius:5px; background:transparent; color:inherit; font:inherit; font-size:12px; line-height:16px; text-align:left; cursor:pointer; }",
      ".dsh-market-match:hover { background:var(--dsw-alias-interactive-bg-hover); }",
      ".dsh-market-match-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",
      ".dsh-market-match-meta { flex:none; color:var(--dsw-alias-label-secondary); font-size:11px; white-space:nowrap; }",
    ].join("\n");

    const SHORT_NAMES = Object.fromEntries(DEFAULT_WATCHLIST.map((item) => [item.secid, item.shortName]));
    const listeners = new Set();
    const watchListeners = new Set();
    const refreshListeners = new Set();
    const sourceErrorListeners = new Set();
    // 面板底部的来源简称：dfcf=东方财富，tx=腾讯；有兜底或有旧数据时加 * 表示不是一次干净的主源刷新。
    const SOURCE_SHORT = { eastmoney: "dfcf", tencent: "tx" };
    const SOURCE_FULL = { eastmoney: "东方财富", tencent: "腾讯" };
    const SOURCE_ERROR_TEXT = {
      blocked: "行情源被拦截",
      unreachable: "行情源不可达",
      empty: "行情源无数据",
      unsupported: "行情源无此品种",
      error: "行情源出错",
    };
    let cachedQuotes = [];
    let lastBody = null;
    let pending;
    let lastSourceError = "";

    function emit() {
      listeners.forEach((fn) => { try { fn(); } catch {} });
    }

    function emitWatch() {
      watchListeners.forEach((fn) => { try { fn(); } catch {} });
    }

    function normalizeItem(item) {
      if (!item || typeof item !== "object" || typeof item.secid !== "string" || !item.secid) return null;
      const known = DEFAULT_WATCHLIST.find((entry) => entry.secid === item.secid);
      return {
        id: item.id || known?.id || item.secid,
        secid: item.secid,
        code: item.code || known?.code || item.secid.split(".").slice(1).join("."),
        name: item.name || known?.name || item.code || item.secid,
        shortName: item.shortName || known?.shortName,
        digits: Number.isInteger(item.digits) ? item.digits : known?.digits,
        tencent: item.tencent || known?.tencent,
        rotate: item.rotate !== false,
      };
    }

    function sourceErrorLabel(sourceError, fallback) {
      const reason = SOURCE_ERROR_TEXT[sourceError?.kind];
      return reason ? `${reason} · ${fallback}` : fallback;
    }

    function sourceSummary(quotes, body) {
      const sources = [...new Set(quotes.map((quote) => quote.source).filter((kind) => SOURCE_SHORT[kind]))];
      if (!sources.length) return { text: "--", title: "暂无行情来源" };
      const degraded = sources.length > 1 || !!body?.degraded || !!body?.stale;
      return {
        text: `${sources.map((kind) => SOURCE_SHORT[kind]).join("+")}${degraded ? "*" : ""}`,
        title: `${degraded ? "非主源刷新，可能不是最新" : "当前行情来源"}：${sources.map((kind) => SOURCE_FULL[kind]).join(" + ")}`,
      };
    }

    function setSourceError(message) {
      const next = String(message ?? "");
      if (next === lastSourceError) return;
      lastSourceError = next;
      sourceErrorListeners.forEach((fn) => { try { fn(next); } catch {} });
    }

    function readWatchlist() {
      try {
        const stored = JSON.parse(localStorage.getItem(WATCH_KEY) || "null");
        if (Array.isArray(stored)) {
          const items = stored.map(normalizeItem).filter(Boolean);
          const seen = new Set();
          return items.filter((item) => {
            if (seen.has(item.secid)) return false;
            seen.add(item.secid);
            return true;
          });
        }
      } catch {}
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_DISPLAY_KEY) || "null");
        if (Array.isArray(legacy)) {
          const extras = legacy
            .map((id) => DEFAULT_WATCHLIST.find((item) => item.id === id))
            .filter(Boolean);
          const shanghai = DEFAULT_WATCHLIST[0];
          const items = [shanghai, ...extras].filter((item, index, list) => list.findIndex((entry) => entry.secid === item.secid) === index);
          if (items.length) return items.map((item) => ({ ...item }));
        }
      } catch {}
      return DEFAULT_WATCHLIST.map((item) => ({ ...item }));
    }

    let watchlist = readWatchlist();

    function updateWatchlist(next) {
      const seen = new Set();
      watchlist = next.map(normalizeItem).filter(Boolean).filter((item) => {
        if (seen.has(item.secid)) return false;
        seen.add(item.secid);
        return true;
      });
      try { localStorage.setItem(WATCH_KEY, JSON.stringify(watchlist)); } catch {}
      emitWatch();
    }

    function moveWatchlistItem(fromSecid, toSecid) {
      const from = watchlist.findIndex((item) => item.secid === fromSecid);
      const to = watchlist.findIndex((item) => item.secid === toSecid);
      if (from < 0 || to < 0 || from === to) return;
      const next = watchlist.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      updateWatchlist(next);
    }

    const REFRESH_DEFAULT = true;
    function readAutoRefresh() {
      try {
        const stored = localStorage.getItem(REFRESH_KEY);
        if (stored === "0") return false;
        if (stored === "1") return true;
      } catch {}
      return REFRESH_DEFAULT;
    }
    let autoRefresh = readAutoRefresh();
    function updateAutoRefresh(next) {
      autoRefresh = !!next;
      try { localStorage.setItem(REFRESH_KEY, autoRefresh ? "1" : "0"); } catch {}
      refreshListeners.forEach((fn) => { try { fn(); } catch {} });
    }

    function quotePageUrl(quote) {
      if (!quote || !quote.secid) return "";
      return QUOTE_PAGE + encodeURIComponent(quote.secid);
    }

    function statusUrl(refresh) {
      const url = new URL(STATUS_PATH, window.location.origin);
      if (refresh) url.searchParams.set("refresh", "1");
      if (watchlist.length) url.searchParams.set("secids", watchlist.map((item) => item.secid).join(","));
      return url;
    }

    async function load(refresh) {
      if (pending && !refresh) return pending;
      const run = (async () => {
        if (!watchlist.length) {
          cachedQuotes = [];
          lastBody = null;
          emit();
          return cachedQuotes;
        }
        const response = await fetch(statusUrl(refresh), { headers: { Accept: "application/json" }, cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(sourceErrorLabel(body.sourceError, body.error || `HTTP ${response.status}`));
        const quotes = Array.isArray(body.quotes) ? body.quotes : [];
        cachedQuotes = quotes.map((quote) => body.stale ? { ...quote, stale: true, staleError: sourceErrorLabel(body.sourceError, body.error) } : quote);
        lastBody = { degraded: !!body.degraded, stale: !!body.stale };
        setSourceError(body.degraded ? "备用行情源" : "");
        if (typeof reply.sourceError === "function") reply.sourceError("");
        emit();
        return cachedQuotes;
      })().catch((error) => {
        if (!cachedQuotes.length) {
          cachedQuotes = watchlist.map((item) => ({ ...item, error: String(error?.message ?? error).slice(0, 120) }));
          emit();
        }
        return cachedQuotes;
      }).finally(() => {
        if (pending === run) pending = undefined;
      });
      pending = run;
      return run;
    }

    function useSourceError() {
      const [message, setMessage] = React.useState(lastSourceError);
      React.useEffect(() => {
        const listener = (next) => setMessage(next);
        sourceErrorListeners.add(listener);
        setMessage(lastSourceError);
        return () => { sourceErrorListeners.delete(listener); };
      }, []);
      return message;
    }

    function useAutoRefresh() {
      const [, update] = React.useState(0);
      React.useEffect(() => {
        const listener = () => update((n) => n + 1);
        refreshListeners.add(listener);
        return () => { refreshListeners.delete(listener); };
      }, []);
      return autoRefresh;
    }

    function useQuotes() {
      const [, update] = React.useState(0);
      const [, updateWatch] = React.useState(0);
      const enabled = useAutoRefresh();
      React.useEffect(() => {
        const listener = () => update((n) => n + 1);
        const watchListener = () => updateWatch((n) => n + 1);
        listeners.add(listener);
        watchListeners.add(watchListener);
        load(false);
        const timer = enabled ? setInterval(() => {
          if (document.visibilityState !== "hidden") load(false);
        }, REFRESH_MS) : undefined;
        return () => {
          listeners.delete(listener);
          watchListeners.delete(watchListener);
          if (timer) clearInterval(timer);
        };
      }, [enabled]);
      return cachedQuotes;
    }

    function formatNumber(value, digits) {
      if (!Number.isFinite(Number(value))) return "--";
      return new Intl.NumberFormat("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value));
    }

    function formatPercent(value) {
      if (!Number.isFinite(Number(value))) return "--";
      const sign = Number(value) > 0 ? "+" : "";
      return `${sign}${formatNumber(value, 2)}%`;
    }

    function shortNameOf(quote) {
      if (quote.shortName) return quote.shortName;
      if (SHORT_NAMES[quote.secid]) return SHORT_NAMES[quote.secid];
      const raw = String(quote.name || quote.code || "");
      const stripped = raw.replace(/(ETF|LOF|基金).*$/u, "").replace(/(指数|指)$/u, "").trim();
      return (stripped || raw).slice(0, 4) || quote.code || "--";
    }

    function digitsOf(quote) {
      return Number.isInteger(quote.digits) ? quote.digits : Math.abs(Number(quote.price)) < 10 ? 3 : 2;
    }

    function trendOf(quote) {
      const value = Number(quote?.changePercent);
      return value > 0 ? "up" : value < 0 ? "down" : "flat";
    }

    function mergeQuotes(quotes) {
      const bySecid = new Map(quotes.map((quote) => [quote.secid, quote]));
      return watchlist.map((item) => {
        const quote = bySecid.get(item.secid);
        return quote ? { ...item, ...quote, name: item.name || quote.name, shortName: item.shortName || quote.shortName } : { ...item };
      });
    }

    function QuoteRow(props) {
      const quote = props.quote;
      const error = quote.error;
      const digits = digitsOf(quote);
      const rotating = quote.rotate !== false;
      return React.createElement("div", {
        className: "dsh-market-row",
        draggable: true,
        "data-trend": error ? "flat" : trendOf(quote),
        "data-dragging": props.dragging ? "true" : "false",
        onDragStart: (event) => {
          if (event.target.closest("button, a")) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", quote.secid);
          props.onDragStart(quote);
        },
        onDragOver: (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          props.onDragOver(quote);
        },
        onDrop: (event) => {
          event.preventDefault();
          props.onDragOver(quote);
        },
        onDragEnd: (event) => {
          event.preventDefault();
          props.onDragEnd();
        },
      },
        React.createElement("span", { className: "dsh-market-handle", title: "拖动调整顺序", "aria-hidden": "true" }, "\u22ee\u22ee"),
        React.createElement("a", {
          className: "dsh-market-row-name",
          href: quotePageUrl(quote) || undefined,
          target: "_blank",
          rel: "noopener noreferrer",
          draggable: false,
          title: quote.code ? `${quote.name} ${quote.code}，打开东方财富行情` : `${quote.name}，打开东方财富行情`,
          onMouseDown: (event) => event.stopPropagation(),
          onClick: (event) => event.stopPropagation(),
        },
          React.createElement("span", { className: "dsh-market-row-name-text" }, quote.name),
          quote.code ? React.createElement("span", { className: "dsh-market-row-code" }, quote.code) : null,
        ),
        React.createElement("span", { className: error ? "dsh-market-row-price dsh-market-row-muted" : "dsh-market-row-price" }, error ? "--" : formatNumber(quote.price, digits)),
        React.createElement("span", {
          className: error ? "dsh-market-row-change dsh-market-row-muted" : "dsh-market-row-change",
          title: quote.stale ? `可能不是最新：${quote.staleError || "上游暂不可用"}` : undefined,
        }, error ? "不可用" : `${formatPercent(quote.changePercent)}${quote.stale ? "*" : ""}`),
        React.createElement("button", {
          type: "button",
          className: "dsh-market-rotate",
          title: rotating ? "从轮播中关闭" : "加入轮播",
          "aria-label": rotating ? `关闭${quote.name}的轮播` : `开启${quote.name}的轮播`,
          "aria-pressed": rotating ? "true" : "false",
          onMouseDown: (event) => event.stopPropagation(),
          onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            props.onToggle(quote);
          },
        }),
        React.createElement("button", {
          type: "button",
          className: "dsh-market-remove",
          title: "移除",
          "aria-label": `移除${quote.name}`,
          onMouseDown: (event) => event.stopPropagation(),
          onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            props.onRemove(quote);
          },
        }, "\u00d7"),
      );
    }

    function AddForm(props) {
      const [query, setQuery] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [hint, setHint] = React.useState("");
      const [hintKind, setHintKind] = React.useState("");
      const [matches, setMatches] = React.useState([]);

      function resetHints() {
        setHint("");
        setHintKind("");
        setMatches([]);
      }

      function applyMatch(match) {
        const result = props.onAdd(match);
        if (result === "exists") {
          setHint("已在列表中");
          setHintKind("");
          setMatches([]);
          return;
        }
        setQuery("");
        resetHints();
      }

      async function submit(event) {
        event.preventDefault();
        event.stopPropagation();
        const value = query.trim();
        if (!value || busy) return;
        setBusy(true);
        resetHints();
        try {
          const url = new URL(RESOLVE_PATH, window.location.origin);
          url.searchParams.set("q", value);
          const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
          const found = Array.isArray(body.matches) ? body.matches : [];
          if (!found.length) {
            setHint("未找到对应代码");
            setHintKind("error");
            return;
          }
          if (found.length === 1) {
            applyMatch(found[0]);
            return;
          }
          setMatches(found);
          setHint("有多条匹配，点选要添加的品种");
          setHintKind("");
        } catch (error) {
          setHint(String(error?.message ?? error).slice(0, 80));
          setHintKind("error");
        } finally {
          setBusy(false);
        }
      }

      return React.createElement("form", {
        className: "dsh-market-add-wrap",
        onSubmit: submit,
        onMouseDown: (event) => event.stopPropagation(),
      },
        React.createElement("div", { className: "dsh-market-add" },
          React.createElement("input", {
            className: "dsh-market-add-input",
            value: query,
            placeholder: "输入代码添加",
            maxLength: 40,
            "aria-label": "输入证券代码添加行情",
            onChange: (event) => {
              setQuery(event.target.value);
              if (hint || matches.length) resetHints();
            },
          }),
          React.createElement("span", {
            className: "dsh-market-source",
            "data-source": String(props.source || "").replace(/\*$/, ""),
            title: props.sourceTitle || "行情来源",
          }, props.source || "--"),
          React.createElement("button", { type: "submit", className: "dsh-market-add-btn", disabled: busy }, busy ? "..." : "添加"),
          React.createElement("button", {
            type: "button",
            className: "dsh-market-autorefresh",
            title: props.autoRefresh ? "关闭自动刷新" : "开启自动刷新",
            "aria-pressed": props.autoRefresh ? "true" : "false",
            onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();
              props.onToggleRefresh();
            },
          },
            React.createElement("span", { className: "dsh-market-autorefresh-label" }, "刷新"),
            React.createElement("span", { className: "dsh-market-rotate", "aria-hidden": "true" }),
          ),
        ),
        hint ? React.createElement("div", { className: "dsh-market-hint", "data-kind": hintKind }, hint) : null,
        React.createElement("div", { className: "dsh-market-hint", "data-source-error": "true" }, props.sourceError || ""),
        matches.length ? React.createElement("div", { className: "dsh-market-matches" },
          matches.map((match) => React.createElement("button", {
            key: match.secid,
            type: "button",
            className: "dsh-market-match",
            onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();
              applyMatch(match);
            },
          },
            React.createElement("span", { className: "dsh-market-match-name" }, match.name),
            React.createElement("span", { className: "dsh-market-match-meta" }, `${match.code} ${match.typeName || ""}`.trim()),
          )),
        ) : null,
      );
    }

    function MarketIndices() {
      const quotes = useQuotes();
      const auto = useAutoRefresh();
      const sourceError = useSourceError();
      const items = mergeQuotes(quotes);
      const hoverRef = React.useRef(null);
      const dragSecidRef = React.useRef("");
      const draggingRef = React.useRef(false);
      const [paused, setPaused] = React.useState(false);
      const [dragging, setDragging] = React.useState(false);
      const [index, setIndex] = React.useState(0);
      const [busy, setBusy] = React.useState(false);
      const carouselItems = items.filter((item) => item.rotate !== false);

      React.useEffect(() => {
        sourceErrorListeners.forEach((fn) => { try { fn(""); } catch {} });
        if (paused || dragging || carouselItems.length <= 1) return undefined;
        const timer = setInterval(() => {
          setIndex((current) => (current + 1) % carouselItems.length);
        }, ROTATE_MS);
        return () => clearInterval(timer);
      }, [index, paused, dragging, carouselItems.length]);

      React.useEffect(() => {
        if (index >= carouselItems.length) setIndex(0);
      }, [index, carouselItems.length]);

      const summary = sourceSummary(items, lastBody);
      const current = carouselItems[Math.min(index, Math.max(carouselItems.length - 1, 0))] || null;
      const trend = current && !current.error ? trendOf(current) : "flat";

      function addItem(match) {
        if (watchlist.some((item) => item.secid === match.secid)) return "exists";
        updateWatchlist([...watchlist, match]);
        load(true);
        return "added";
      }

      function removeItem(quote) {
        updateWatchlist(watchlist.filter((item) => item.secid !== quote.secid));
        load(false);
      }

      function toggleRotate(quote) {
        updateWatchlist(watchlist.map((item) => (
          item.secid === quote.secid ? { ...item, rotate: item.rotate === false } : item
        )));
      }

      function startDrag(quote) {
        dragSecidRef.current = quote.secid;
        draggingRef.current = true;
        setDragging(true);
        setPaused(true);
      }

      function dragOver(quote) {
        const from = dragSecidRef.current;
        if (!from || from === quote.secid) return;
        moveWatchlistItem(from, quote.secid);
      }

      function endDrag() {
        dragSecidRef.current = "";
        draggingRef.current = false;
        setDragging(false);
      }

      return React.createElement("span", { className: "dsh-market-indices" },
        React.createElement("span", {
          className: "dsh-market-hover",
          ref: hoverRef,
          "data-pinned": dragging ? "true" : "false",
          onMouseEnter: () => setPaused(true),
          onMouseLeave: () => { if (!draggingRef.current) setPaused(false); },
          onFocusCapture: () => setPaused(true),
          onBlurCapture: (event) => {
            const root = hoverRef.current;
            if (root && event.relatedTarget && root.contains(event.relatedTarget)) return;
            setPaused(false);
          },
        },
          React.createElement("button", {
            type: "button",
            className: "dsh-market-ticker",
            "data-trend": trend,
            "data-busy": busy ? "true" : "false",
            "aria-label": current ? `${current.name} ${current.stale ? "可能不是最新" : ""}${current.error || formatPercent(current.changePercent)}，悬浮查看全部，点击刷新` : "暂无行情，悬浮添加",
            title: current ? `${current.name} ${current.error || `${formatNumber(current.price, digitsOf(current))} ${formatPercent(current.changePercent)}`}` : "悬浮添加行情",
            onMouseDown: (event) => event.stopPropagation(),
            onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (busy || !watchlist.length) return;
              setBusy(true);
              load(true).finally(() => setBusy(false));
            },
          },
            React.createElement("span", { className: "dsh-market-ticker-text" },
              current
                ? React.createElement(React.Fragment, null,
                  React.createElement("span", { className: "dsh-market-ticker-name" }, shortNameOf(current)),
                  React.createElement("span", { className: current.error ? "dsh-market-ticker-value dsh-market-ticker-muted" : "dsh-market-ticker-value" }, current.error ? "--" : `${formatPercent(current.changePercent)}${current.stale ? "*" : ""}`),
                )
                : React.createElement("span", { className: "dsh-market-ticker-muted" }, "行情"),
            ),
          ),
          React.createElement("div", { className: "dsh-market-panel", role: "region", "aria-label": "市场行情" },
            items.length
              ? React.createElement("div", { className: "dsh-market-list" },
                items.map((quote) => React.createElement(QuoteRow, {
                  key: quote.secid,
                  quote,
                  dragging: dragging && dragSecidRef.current === quote.secid,
                  onRemove: removeItem,
                  onToggle: toggleRotate,
                  onDragStart: startDrag,
                  onDragOver: dragOver,
                  onDragEnd: endDrag,
                })),
              )
              : React.createElement("div", { className: "dsh-market-empty" }, "还没有行情，输入代码添加"),
            React.createElement(AddForm, {
              onAdd: addItem,
              autoRefresh: auto,
              onToggleRefresh: () => updateAutoRefresh(!autoRefresh),
              sourceError,
              source: summary.text,
              sourceTitle: summary.title,
            }),
          ),
        ),
      );
    }

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (!slots) return;
      const styleTag = document.createElement("style");
      styleTag.dataset.plugin = "dsh-market-indices";
      styleTag.textContent = CSS;
      document.head.appendChild(styleTag);
      ctx.effect(() => () => { if (styleTag.isConnected) styleTag.remove(); });
      slots.inject("conversation.session.header.utilities", () => slots.register(
        { name: "conversation.session.header.utilities", id: "dsh-market-indices", order: -19, label: () => "市场行情" },
        MarketIndices,
      ));
    }

    exports.apply = apply;
    exports.putError = function (message) { setSourceError(message); };
    exports.inject = ["slots"];
    exports.name = "dsh-market-indices-client";
    return module.exports;
  },
});
