const name = "dsh-market-indices";
const STATUS_PATH = "/plugins/dsh-market-indices/status";
const RESOLVE_PATH = "/plugins/dsh-market-indices/resolve";
const ULIST_URL = "https://push2.eastmoney.com/api/qt/ulist.np/get";
const SEARCH_URL = "https://searchapi.eastmoney.com/api/suggest/get";
const TENCENT_URL = "https://qt.gtimg.cn/q=";
const SEARCH_TOKEN = "D43BF01C27C4F480E4060ED73C4F1F3B";
const ULIST_FIELDS = "f2,f3,f4,f12,f13,f14,f18";
const MAX_WATCHLIST = 30;
const CACHE_TTL_MS = 8_000;
const CACHE_LIMIT = 64;
const DEFAULT_INSTRUMENTS = [
  { id: "shanghai", secid: "1.000001", code: "000001", name: "上证指数", shortName: "上证", kind: "index", digits: 2, tencent: "sh000001" },
  { id: "chinext", secid: "0.399006", code: "399006", name: "创业板指", shortName: "创业", kind: "index", digits: 2, tencent: "sz399006" },
  { id: "hang-seng", secid: "100.HSI", code: "HSI", name: "恒生指数", shortName: "恒生", kind: "index", digits: 2, tencent: "hkHSI" },
  { id: "nasdaq", secid: "100.NDX", code: "NDX", name: "纳斯达克", shortName: "纳指", kind: "index", digits: 2, tencent: "us.IXIC" },
  { id: "sp500", secid: "100.SPX", code: "SPX", name: "标普500", shortName: "标普", kind: "index", digits: 2, tencent: "us.INX" },
];
// 东方财富 secid 的市场前缀 → 腾讯代码前缀；没有对应品种的市场（期货、外盘等）不支持兜底。
const TENCENT_MARKET_PREFIX = { 0: "sz", 1: "sh", 100: "hk", 105: "us", 106: "us", 107: "us", 116: "hk" };
// 100 是东财的「全球指数」，腾讯美股指数用带点的代码，直接拼会撞上同号美股 ETF。
// 东财 100.NDX 是纳斯达克综合指数，对应腾讯 us.IXIC；usNDX 是纳斯达克 100，两者点位不同。
const UNIVERSAL_INDEX_TENCENT = { 100: { HSI: "hkHSI", NDX: "us.IXIC", SPX: "us.INX", DJIA: "us.DJI" } };
const SOURCE_ERRORS = {
  blocked: "行情源被拦截",
  unreachable: "行情源不可达",
  empty: "行情源无数据",
  unsupported: "行情源无此品种",
  error: "行情源出错",
};
const SECID_RE = /^\d{1,3}\.[A-Za-z0-9][A-Za-z0-9._-]*$/;
const cache = new Map();
const inflight = new Map();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function hostnameOfHost(host) {
  if (typeof host !== "string" || host.trim() === "") return "";
  let hostname = host.trim().toLowerCase();
  if (hostname.startsWith("[")) {
    const end = hostname.indexOf("]");
    return end === -1 ? hostname : hostname.slice(0, end + 1);
  }
  const colon = hostname.lastIndexOf(":");
  if (colon !== -1 && !hostname.slice(0, colon).includes(":") && /^\d+$/.test(hostname.slice(colon + 1))) {
    hostname = hostname.slice(0, colon);
  }
  return hostname;
}

function isLoopbackRequest(req) {
  const host = hostnameOfHost(req.headers.host);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(host)) return false;
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin.trim() === "") return true;
  try {
    const originHost = new URL(origin).hostname.toLowerCase();
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(originHost);
  } catch {
    return false;
  }
}

function isValidSecid(secid) {
  return typeof secid === "string" && SECID_RE.test(secid);
}

function inferDigits(price) {
  if (!Number.isFinite(Number(price))) return 2;
  return Math.abs(Number(price)) < 10 ? 3 : 2;
}

function guessKind(classify, typeName, name) {
  const hay = `${classify || ""} ${typeName || ""} ${name || ""}`;
  if (/指数|Index/i.test(hay)) return "index";
  if (/ETF|基金|Fund/i.test(hay)) return "etf";
  return "stock";
}

function knownInstrument(secid) {
  return DEFAULT_INSTRUMENTS.find((item) => item.secid === secid);
}

// 已知品种带手工写死的腾讯代码；搜索结果用东财返回的市场号推导，两者都没有时返回 ""。
function tencentCodeOf(instrument) {
  const known = knownInstrument(instrument?.secid);
  if (instrument?.tencent) return instrument.tencent;
  if (known?.tencent) return known.tencent;
  const secid = String(instrument?.secid ?? "");
  const dot = secid.indexOf(".");
  const prefix = Number(secid.slice(0, dot));
  const code = secid.slice(dot + 1);
  if (dot === -1 || !code) return "";
  if (!code.includes(".")) {
    const mapped = UNIVERSAL_INDEX_TENCENT[prefix]?.[code];
    if (mapped) return mapped;
    // 全球指数在腾讯基本都是美股代码 ln（纳斯达克=.IXIC）；没有映射的只能按同名不同物处理，不走兜底。
    if (prefix === 100) return "";
  }
  const marketPrefix = TENCENT_MARKET_PREFIX[prefix];
  return marketPrefix ? `${marketPrefix}${code}` : "";
}

function decodeGbk(buffer) {
  try {
    return new TextDecoder("gbk").decode(buffer);
  } catch {
    return "";
  }
}

function tencentTimestamp(raw) {
  const text = String(raw ?? "").trim();
  let match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(text);
  const parts = match
    ? [match[1], match[2], match[3], match[4], match[5], match[6]]
    : (/^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text)?.slice(1) ?? null);
  if (!parts) return null;
  const [year, month, day, hour, minute, second] = parts.map(Number);
  const value = new Date(year, month - 1, day, hour, minute, second).getTime();
  return Number.isFinite(value) ? value : null;
}

// Number("") / Number(null) / Number(true) 会变成 0 或 1，空字段不能当成行情。
function blankQuoteField(value) {
  return value == null || typeof value === "boolean" || (typeof value === "string" && value.trim() === "");
}

function parseTencentQuote(fields) {
  if ([fields?.[3], fields?.[31], fields?.[32]].some(blankQuoteField)) return null;
  const price = Number(fields[3]);
  const change = Number(fields[31]);
  const changePercent = Number(fields[32]);
  if (![price, change, changePercent].every(Number.isFinite)) return null;
  const previousClose = blankQuoteField(fields?.[4]) ? Number.NaN : Number(fields[4]);
  return {
    name: String(fields[1] ?? "").trim(),
    code: String(fields[2] ?? "").trim(),
    price,
    change,
    changePercent,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    quoteAt: tencentTimestamp(fields[30]),
  };
}

function parseTencentBody(text) {
  const byCode = new Map();
  for (const match of String(text ?? "").matchAll(/v_([A-Za-z0-9.]+)="([^"]*)"/g)) {
    const quote = parseTencentQuote(match[2].split("~"));
    if (quote) byCode.set(match[1], quote);
  }
  return byCode;
}

// 腾讯美股代码带交易所后缀（AAPL.OQ / .N / .A），和东财代码比之前先去掉。
function normalizeTencentCode(code) {
  return String(code ?? "").trim().replace(/\.(OQ|N|A)$/i, "").toLowerCase();
}

// 兜底结果必须和东财认可的名字对上：腾讯按前缀拼代码时可能命中同名不同物，
// 例如 107.DJIA 在东财是 Global X 的 ETF，腾讯 usDJIA 是另一只 ETF，名字不符就判为无此品种。
// 自定义品种在服务端只有代码（name === code），这时改对腾讯返回的代码。
function tencentNameMatches(instrument, source) {
  const candidate = typeof source === "string" ? source : source?.name;
  const knownName = String(knownInstrument(instrument.secid)?.name ?? "").trim();
  const actual = String(candidate ?? "").trim();
  if (knownName) return !!actual && actual.includes(knownName);
  const expectedName = String(instrument.name ?? "").trim();
  const instrumentCode = String(instrument.code ?? "").trim();
  if (!expectedName || expectedName === instrumentCode) {
    const returned = normalizeTencentCode(typeof source === "object" && source ? source.code : "");
    const expected = normalizeTencentCode(instrumentCode);
    return !!returned && !!expected && returned === expected;
  }
  if (!actual) return false;
  if (expectedName.length <= 3) return actual.includes(expectedName);
  const sample = expectedName.slice(0, 3);
  if (actual.includes(sample)) return true;
  let score = 0;
  for (const char of new Set(sample)) if (actual.includes(char)) score += 1;
  return score * 2 > sample.length;
}

function quoteFromTencent(source, instrument) {
  const price = Number(source.price);
  const known = knownInstrument(instrument.secid);
  const digits = Number.isInteger(instrument.digits) ? instrument.digits : known?.digits ?? inferDigits(price);
  return {
    id: instrument.id || known?.id || instrument.secid,
    secid: instrument.secid,
    code: instrument.code,
    name: known?.name || instrument.name || source.name || instrument.code,
    shortName: instrument.shortName || known?.shortName,
    kind: instrument.kind || known?.kind || guessKind("", "", instrument.name),
    digits,
    price,
    change: Number(source.change),
    changePercent: Number(source.changePercent),
    previousClose: source.previousClose,
    source: "tencent",
    quoteAt: source.quoteAt,
    updatedAt: Date.now(),
  };
}

function instrumentFromSecid(secid) {
  const known = knownInstrument(secid);
  if (known) return { ...known };
  const dot = secid.indexOf(".");
  return { id: secid, secid, code: secid.slice(dot + 1), name: secid.slice(dot + 1), kind: "stock" };
}

function parseUlistRow(row, instrument) {
  if ([row?.f2, row?.f3, row?.f4].some(blankQuoteField)) {
    throw new Error(`${instrument.name || instrument.secid}: invalid quote payload`);
  }
  const price = Number(row?.f2);
  const changePercent = Number(row?.f3);
  const change = Number(row?.f4);
  const previousClose = blankQuoteField(row?.f18) ? Number.NaN : Number(row?.f18);
  if (![price, changePercent, change].every(Number.isFinite)) {
    throw new Error(`${instrument.name || instrument.secid}: invalid quote payload`);
  }
  const code = String(row?.f12 ?? instrument.code ?? "").trim() || instrument.code;
  const name = String(row?.f14 ?? instrument.name ?? code).trim() || code;
  const market = row?.f13;
  const secid = instrument.secid || (market === undefined || market === null ? "" : `${market}.${code}`);
  const known = knownInstrument(secid);
  const digits = Number.isInteger(instrument.digits) ? instrument.digits : known?.digits ?? inferDigits(price);
  return {
    id: instrument.id || known?.id || secid,
    secid,
    code,
    name: known?.name && known.code === code ? known.name : name,
    shortName: instrument.shortName || known?.shortName,
    kind: instrument.kind || known?.kind || guessKind("", "", name),
    digits,
    price,
    change,
    changePercent,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    source: "eastmoney",
    updatedAt: Date.now(),
  };
}

function requestUrl(req) {
  try { return new URL(req.url ?? "/", "http://localhost"); } catch { return new URL("http://localhost/"); }
}

function requestedInstruments(req) {
  const raw = requestUrl(req).searchParams.get("secids");
  const secids = typeof raw === "string" && raw.trim() !== ""
    ? raw.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
  if (!secids.length) return DEFAULT_INSTRUMENTS.map((item) => ({ ...item }));
  if (secids.length > MAX_WATCHLIST) {
    const error = new Error(`watchlist cannot exceed ${MAX_WATCHLIST}`);
    error.status = 400;
    throw error;
  }
  for (const secid of secids) {
    if (!isValidSecid(secid)) {
      const error = new Error(`invalid secid: ${secid}`);
      error.status = 400;
      throw error;
    }
  }
  return secids.map(instrumentFromSecid);
}

function cacheKey(instruments) {
  return instruments.map((item) => item.secid).join(",");
}

function writeCache(key, value) {
  cache.delete(key);
  cache.set(key, { value, at: Date.now() });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

function sourceError(kind, cause) {
  const error = new Error(cause ? `${SOURCE_ERRORS[kind]}: ${cause}` : SOURCE_ERRORS[kind]);
  error.sourceKind = kind;
  return error;
}

// 东财被拦截时返回的是空响应/RST 或 null data，按原因分类，便于前端区分提示。
function classifyFetchError(error) {
  const text = `${error?.cause?.code ?? ""} ${error?.cause?.message ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (/und_err_socket|econnreset|econnrefused|epipe/.test(text)) return "blocked";
  if (/fetch failed|timeout|timed out|aborted/.test(text)) return "unreachable";
  return "error";
}

// null 表示该品种在腾讯无对应行情（例如期货、外盘市场），不能算兜底失败。
async function fetchTencentQuotes(instruments) {
  const codes = instruments.map(tencentCodeOf);
  const targets = [...new Set(codes.filter(Boolean))];
  if (!targets.length) throw sourceError("unsupported");
  let response;
  try {
    response = await fetch(`${TENCENT_URL}${targets.join(",")}`, {
      headers: { Accept: "*/*", Referer: "https://gu.qq.com/" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    throw sourceError("unreachable", error?.cause?.code ?? error?.message);
  }
  if (!response.ok) throw sourceError("unreachable", `HTTP ${response.status}`);
  const byCode = parseTencentBody(decodeGbk(await response.arrayBuffer()));
  if (!byCode.size) throw sourceError("empty");
  return instruments.map((instrument, index) => {
    const source = byCode.get(codes[index]);
    if (!source) return null;
    if (!tencentNameMatches(instrument, source)) return null;
    try {
      return quoteFromTencent(source, instrument);
    } catch {
      return null;
    }
  });
}

async function fetchQuotes(instruments) {
  if (!instruments.length) return { quotes: [], updatedAt: Date.now() };
  const url = new URL(ULIST_URL);
  url.searchParams.set("fltt", "2");
  url.searchParams.set("invt", "2");
  url.searchParams.set("secids", instruments.map((item) => item.secid).join(","));
  url.searchParams.set("fields", ULIST_FIELDS);
  let primaryError;
  let quotes = [];
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", Referer: "https://quote.eastmoney.com/" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`quote HTTP ${response.status}`);
    const body = await response.json();
    const rows = Array.isArray(body?.data?.diff) ? body.data.diff : [];
    if (!rows.length) throw sourceError("empty");
    const bySecid = new Map();
    for (const row of rows) {
      if (row?.f12 === undefined || row?.f13 === undefined || row?.f13 === null) continue;
      bySecid.set(`${row.f13}.${row.f12}`, row);
    }
    quotes = instruments.map((instrument) => {
      const row = bySecid.get(instrument.secid);
      if (!row) return { ...instrument, error: SOURCE_ERRORS.empty, updatedAt: Date.now() };
      try {
        return parseUlistRow(row, instrument);
      } catch (error) {
        return { ...instrument, error: String(error?.message ?? error).slice(0, 120), updatedAt: Date.now() };
      }
    });
  } catch (error) {
    primaryError = sourceError(classifyFetchError(error), error?.message);
    quotes = [];
  }

  const missing = instruments.filter((instrument, index) => !quotes[index] || quotes[index].error);
  if (!missing.length) return { quotes, updatedAt: Date.now() };

  let fallback;
  try {
    fallback = await fetchTencentQuotes(missing);
  } catch (error) {
    const reasons = { ...(primaryError ? { eastmoney: primaryError.sourceKind } : {}), tencent: error.sourceKind };
    // 东财已经有部分有效行情时，腾讯兜底失败只保留缺失项的不可用状态。
    if (quotes.some((quote) => quote && !quote.error)) return { quotes, updatedAt: Date.now() };
    const failure = sourceError(primaryError?.sourceKind ?? error.sourceKind, Object.entries(reasons).map(([key, value]) => `${key}:${value}`).join(","));
    failure.reasons = reasons;
    throw failure;
  }

  const resolved = new Map();
  missing.forEach((instrument, index) => {
    if (fallback[index]) resolved.set(instrument.secid, fallback[index]);
  });
  const merged = instruments.map((instrument, index) => resolved.get(instrument.secid) ?? quotes[index]);
  if (!merged.some((quote) => quote && !quote.error)) throw sourceError(primaryError?.sourceKind ?? "empty", primaryError?.message ?? "no usable quote");
  return {
    quotes: merged.map((quote, index) => quote ?? { ...instruments[index], error: SOURCE_ERRORS.empty, updatedAt: Date.now() }),
    updatedAt: Date.now(),
    source: merged.every((quote) => quote?.source === "tencent") ? "tencent" : "mixed",
    ...(primaryError ? { degraded: true } : {}),
  };
}

async function getQuotes(instruments, refresh) {
  const key = cacheKey(instruments);
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  if (inflight.has(key)) return inflight.get(key);
  const pending = fetchQuotes(instruments).then((value) => {
    writeCache(key, value);
    return value;
  }).finally(() => {
    if (inflight.get(key) === pending) inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

function pickMatches(query, results) {
  const needle = String(query ?? "").trim().toLowerCase();
  if (!needle) return [];
  const exact = results.filter((item) => String(item.code ?? "").toLowerCase() === needle);
  return exact.length ? exact : results;
}

function parseSearchRow(row) {
  const secid = typeof row?.QuoteID === "string" ? row.QuoteID : "";
  if (!isValidSecid(secid)) return null;
  const code = String(row?.Code ?? "").trim();
  const name = String(row?.Name ?? "").trim() || code;
  if (!code) return null;
  const known = knownInstrument(secid);
  return {
    id: known?.id || secid,
    secid,
    code,
    name: known?.name || name,
    shortName: known?.shortName,
    kind: known?.kind || guessKind(row?.Classify, row?.SecurityTypeName, name),
    typeName: row?.SecurityTypeName || "",
    classify: row?.Classify || "",
  };
}

async function searchInstruments(query) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("input", query);
  url.searchParams.set("type", "14");
  url.searchParams.set("token", SEARCH_TOKEN);
  url.searchParams.set("count", "8");
  const response = await fetch(url, {
    headers: { Accept: "application/json", Referer: "https://quote.eastmoney.com/" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`search HTTP ${response.status}`);
  const body = await response.json();
  const rows = Array.isArray(body?.QuotationCodeTable?.Data) ? body.QuotationCodeTable.Data : [];
  return rows.map(parseSearchRow).filter(Boolean);
}

function statusHandler() {
  return async (req, res) => {
    if (req.method !== "GET") {
      json(res, 405, { error: "method not allowed" });
      return;
    }
    if (!isLoopbackRequest(req)) {
      json(res, 403, { error: "request-not-trusted" });
      return;
    }
    let instruments;
    try {
      instruments = requestedInstruments(req);
    } catch (error) {
      json(res, error.status || 400, { error: String(error?.message ?? error).slice(0, 160) });
      return;
    }
    const refresh = requestUrl(req).searchParams.get("refresh") === "1";
    try {
      json(res, 200, await getQuotes(instruments, refresh));
    } catch (error) {
      const kind = error?.sourceKind ?? "unreachable";
      const reason = SOURCE_ERRORS[kind] ?? SOURCE_ERRORS.unreachable;
      const stale = cache.get(cacheKey(instruments));
      if (stale?.value) {
        json(res, 200, { ...stale.value, stale: true, sourceError: { kind, reason, reasons: error?.reasons ?? null }, error: String(error?.message ?? error).slice(0, 160) });
        return;
      }
      json(res, 502, { error: reason, sourceError: { kind, reason, reasons: error?.reasons ?? null } });
    }
  };
}

function resolveHandler() {
  return async (req, res) => {
    if (req.method !== "GET") {
      json(res, 405, { error: "method not allowed" });
      return;
    }
    if (!isLoopbackRequest(req)) {
      json(res, 403, { error: "request-not-trusted" });
      return;
    }
    const query = requestUrl(req).searchParams.get("q")?.trim() ?? "";
    if (!query || query.length > 40) {
      json(res, 400, { error: "invalid query" });
      return;
    }
    try {
      const matches = pickMatches(query, await searchInstruments(query));
      json(res, 200, { query, matches: matches.map((match) => ({ ...match, tencent: tencentCodeOf(match) })) });
    } catch (error) {
      const kind = classifyFetchError(error);
      json(res, 502, { error: String(error?.message ?? error).slice(0, 160), sourceError: { kind, reason: SOURCE_ERRORS[kind] } });
    }
  };
}

function apply(ctx) {
  ctx.inject(["webServer"], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: "exact",
      path: STATUS_PATH,
      handler: statusHandler(),
    }), "dsh-market-indices: status route");
    webCtx.effect(() => webCtx.webServer.register({
      kind: "exact",
      path: RESOLVE_PATH,
      handler: resolveHandler(),
    }), "dsh-market-indices: resolve route");
  });
}

export {
  DEFAULT_INSTRUMENTS,
  apply,
  inferDigits,
  isValidSecid,
  name,
  parseUlistRow,
  pickMatches,
};
