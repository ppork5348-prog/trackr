/**
 * FOMO Recovery Proxy — Netlify Function
 * Fetches Privy key material, auth shares, and encrypted recovery shares
 * Supports both EVM (Ethereum) and Solana
 */

function cors(headers) {
  headers["Access-Control-Allow-Origin"] = "*";
  headers["Access-Control-Allow-Credentials"] = "true";
  headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, privy-app-id, privy-client-id, privy-mfa-token, privy-ca-id";
  headers["Access-Control-Max-Age"] = "86400";
  return headers;
}

function b64ToBuf(s) {
  const n = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const p = "=".repeat((4 - (n.length % 4)) % 4);
  return Buffer.from(n + p, "base64");
}

function sha256Buf(buf) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(buf).digest();
}

function privyHeaders({ appId, clientId, accessToken, mfaToken, caId }) {
  const h = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Origin: "https://auth.privy.io",
    Referer: "https://auth.privy.io/",
  };
  if (appId) h["privy-app-id"] = appId;
  if (clientId) h["privy-client-id"] = clientId;
  if (caId) h["privy-ca-id"] = caId;
  if (accessToken) {
    const t = String(accessToken).replace(/^Bearer\s+/i, "").replace(/"/g, "");
    h.authorization = `Bearer ${t}`;
  }
  if (mfaToken) h["privy-mfa-token"] = mfaToken;
  return h;
}

async function privyPost(url, headers, body) {
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, ok: r.ok, data };
}

exports.handler = async (event) => {
  const headers = cors({});

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    let p = event.body || "{}";
    if (event.isBase64Encoded) p = Buffer.from(p, "base64").toString("utf8");
    try { p = JSON.parse(p); } catch { p = {}; }

    const {
      appId,
      clientId,
      wallet,
      accessToken,
      recoveryKey,
      mfaToken,
      caId,
    } = p;

    const chainType = p.chainType || p.chain_type || "ethereum";

    if (!appId || !wallet || !accessToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Required: appId, wallet, accessToken" }),
      };
    }

    const h = privyHeaders({ appId, clientId, accessToken, mfaToken, caId });
    const base = `https://auth.privy.io/api/v1/embedded_wallets/${encodeURIComponent(wallet)}/recovery`;

    let keyMaterial = null;
    try {
      keyMaterial = await privyPost(`${base}/key_material`, h, { chain_type: chainType });
    } catch (e) {
      keyMaterial = { status: 0, ok: false, data: { error: e.message } };
    }

    const rk = recoveryKey || keyMaterial?.data?.recovery_key || keyMaterial?.data?.recoveryKey || null;

    let hashB64 = null;
    let hashHex = null;
    if (rk) {
      const dig = sha256Buf(b64ToBuf(rk));
      hashB64 = dig.toString("base64");
      hashHex = dig.toString("hex");
    }

    const auth = await privyPost(`${base}/auth_share`, h, { chain_type: chainType });

    let shares = null;
    const shareAttempts = [];
    if (hashB64) {
      const s1 = await privyPost(`${base}/shares`, h, {
        recovery_key_hash: hashB64,
        chain_type: chainType,
      });
      shareAttempts.push({ hash: "b64", ...s1 });
      if (s1.ok) shares = s1;
    }
    if ((!shares || !shares.ok) && hashHex) {
      const s2 = await privyPost(`${base}/shares`, h, {
        recovery_key_hash: hashHex,
        chain_type: chainType,
      });
      shareAttempts.push({ hash: "hex", ...s2 });
      if (s2.ok) shares = s2;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        wallet,
        chainType,
        recoveryType: keyMaterial?.data?.recovery_type || keyMaterial?.data?.recoveryType || null,
        hasRecoveryKey: !!rk,
        recoveryKeyHashB64: hashB64,
        recoveryKeyHashHex: hashHex,
        key_material: keyMaterial,
        auth_share: auth,
        shares: shares || shareAttempts[shareAttempts.length - 1] || null,
        shareAttempts,
        recoveryKey: rk || null,
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
};