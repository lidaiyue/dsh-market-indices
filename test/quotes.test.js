import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_INSTRUMENTS,
  apply,
  inferDigits,
  isValidSecid,
  name,
  parseUlistRow,
  pickMatches,
} from "../lib/index.js";

const source = await readFile(new URL("../lib/index.js", import.meta.url), "utf8");

test("parses Eastmoney ulist floats as price, change, and percent", () => {
  const quote = parseUlistRow({
    f2: 3533.79, f3: -1.23, f4: -43.83, f12: "000001", f13: 1, f14: "上证指数", f18: 3577.62,
  }, { id: "shanghai", secid: "1.000001", code: "000001", name: "上证指数", digits: 2 });
  assert.equal(quote.price, 3533.79);
  assert.equal(quote.change, -43.83);
  assert.equal(quote.changePercent, -1.23);
  assert.equal(quote.previousClose, 3577.62);
  assert.equal(quote.secid, "1.000001");
});

test("keeps ETF prices in yuan instead of scaling them by 10", () => {
  const quote = parseUlistRow({
    f2: 0.858, f3: -1.15, f4: -0.01, f12: "513050", f13: 1, f14: "中概互联网ETF易方达", f18: 0.868,
  }, { id: "china-internet", secid: "1.513050", code: "513050", name: "中概互联ETF", digits: 3 });
  assert.equal(quote.price, 0.858);
  assert.equal(quote.change, -0.01);
  assert.equal(quote.changePercent, -1.15);
  assert.equal(quote.digits, 3);
  assert.notEqual(quote.price, 8.58);
});

test("does not derive percent from the wrong Eastmoney field", () => {
  assert.doesNotMatch(source, /changePercent:\s*\(change \/ previousClose\)/);
  assert.match(source, /changePercent = Number\(row\?\.f3\)/);
  // 东财是主源，腾讯只是兜底：两者必须都还在
  assert.match(source, /push2\.eastmoney\.com\/api\/qt\/ulist\.np\/get/);
  assert.match(source, /qt\.gtimg\.cn/);
  assert.match(source, /fltt/);
});

test("infers three decimal places for low-priced ETFs", () => {
  assert.equal(inferDigits(0.858), 3);
  assert.equal(inferDigits(3533.79), 2);
  assert.equal(inferDigits(22410.8), 2);
});

test("validates secid shape before calling upstream", () => {
  assert.equal(isValidSecid("1.000001"), true);
  assert.equal(isValidSecid("100.HSI"), true);
  assert.equal(isValidSecid("0.159813"), true);
  assert.equal(isValidSecid("105.AAPL"), true);
  assert.equal(isValidSecid("1.000001,0.399006"), false);
  assert.equal(isValidSecid("https://example.com"), false);
  assert.equal(isValidSecid(""), false);
});

test("keeps source error details on the status response when upstreams fail", async (t) => {
  const original = globalThis.fetch;
  // 不打外网：东财抛空响应、腾讯无此代码（145.10 是没有对应腾讯代码的期货市场）
  globalThis.fetch = async () => {
    throw Object.assign(new Error("fetch failed"), { cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }) });
  };
  t.after(() => { globalThis.fetch = original; });
  const handlers = {};
  apply({
    inject: (services, callback) => callback({
      effect: (effect) => effect(),
      webServer: { register: (route) => { handlers[route.path] = route.handler; return () => {}; } },
    }),
  });
  const result = {};
  const res = {
    writeHead: (status) => { result.status = status; },
    end: (body) => { result.body = JSON.parse(body); },
  };
  await handlers["/plugins/dsh-market-indices/status"]({ method: "GET", headers: { host: "127.0.0.1:3080" }, url: "/?secids=145.10" }, res);
  assert.equal(result.status, 502);
  assert.equal(result.body.error, "行情源被拦截");
  assert.equal(result.body.sourceError.kind, "blocked");
  assert.deepEqual(result.body.sourceError.reasons, { eastmoney: "blocked", tencent: "unsupported" });
});

test("prefers exact code matches when resolving a query", () => {
  const rows = [
    { code: "000001", name: "平安银行", secid: "0.000001" },
    { code: "000001", name: "上证指数", secid: "1.000001" },
    { code: "000001.SH", name: "其它", secid: "1.000002" },
  ];
  const matches = pickMatches("000001", rows);
  assert.deepEqual(matches.map((item) => item.secid), ["0.000001", "1.000001"]);
  assert.deepEqual(pickMatches("上证", [
    { code: "000001", name: "上证指数", secid: "1.000001" },
    { code: "000016", name: "上证50", secid: "1.000016" },
  ]).map((item) => item.secid), ["1.000001", "1.000016"]);
});

test("ships the default instruments and a resolve endpoint", () => {
  assert.equal(name, "dsh-market-indices");
  for (const secid of ["1.000001", "0.399006", "100.HSI", "1.000300", "1.513050", "1.513120", "0.159813", "1.512760"]) {
    assert.ok(source.includes(secid), `missing instrument ${secid}`);
    assert.ok(DEFAULT_INSTRUMENTS.some((item) => item.secid === secid));
  }
  assert.match(source, /isLoopbackRequest\(req\)/);
  assert.match(source, /\/plugins\/dsh-market-indices\/resolve/);
});

test("falls back to Tencent only for the instruments Eastmoney did not return", () => {
  // 东财失败/缺项 -> 只对缺失项请求腾讯兜底
  assert.match(source, /const missing = instruments\.filter/);
  assert.match(source, /fetchTencentQuotes\(missing\)/);
  assert.match(source, /parseTencentBody/);
  assert.match(source, /new TextDecoder\("gbk"\)/);
});

test("classifies upstream failures so the UI can tell blocked from empty", () => {
  for (const kind of ["blocked", "unreachable", "empty", "unsupported", "error"]) {
    assert.match(source, new RegExp(`${kind}: "行情源`), `missing label for ${kind}`);
  }
  assert.match(source, /sourceError\s*:\s*\{ kind, reason/);
});

test("mounts GET-only handlers and rejects untrusted origins", async () => {
  const handlers = {};
  const ctx = {
    inject: (services, callback) => callback({
      effect: (effect) => effect(),
      webServer: {
        register: (route) => {
          handlers[route.path] = route.handler;
          return () => {};
        },
      },
    }),
  };
  apply(ctx);
  assert.ok(handlers["/plugins/dsh-market-indices/status"]);
  assert.ok(handlers["/plugins/dsh-market-indices/resolve"]);

  async function request(path, method, headers, url = "/") {
    let result;
    const res = {
      writeHead: (status) => { result = { status }; },
      end: (body) => { result.body = JSON.parse(body); },
    };
    await handlers[path]({ method, headers, url }, res);
    return result;
  }

  const local = { host: "127.0.0.1:3080" };
  assert.equal((await request("/plugins/dsh-market-indices/status", "POST", local)).status, 405);
  assert.equal((await request("/plugins/dsh-market-indices/status", "GET", { host: "example.com", origin: "https://example.com" })).status, 403);
  assert.equal((await request("/plugins/dsh-market-indices/resolve", "GET", { host: "example.com", origin: "https://example.com" }, "/?q=513050")).status, 403);
  assert.equal((await request("/plugins/dsh-market-indices/status", "GET", local, "/?secids=bad")).status, 400);
});
