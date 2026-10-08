const env = require('../config/env');

/**
 * Thin client for the Diamond odds feed (see http://77.37.44.135:3009/docs).
 * The key travels as `?key=`. Requests carry an explicit Accept header —
 * without one some endpoints hang instead of answering.
 */

const TIMEOUT_MS = 15000;
const CRICKET_SID = 4;

const isConfigured = () => Boolean(env.diamond.apiKey);

async function request(method, path, { query = {}, body } = {}) {
  const url = new URL(`${env.diamond.baseUrl}${path}`);
  Object.entries({ ...query, key: env.diamond.apiKey }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'betting-backend/1.0' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Diamond ${path}: non-JSON response (${res.status})`);
  }
  if (!res.ok && !json?.message) throw new Error(`Diamond ${path}: HTTP ${res.status}`);
  return json;
}

/** Live + upcoming cricket matches: `t1` holds real fixtures, `t2` virtual / e-cricket ones. */
async function cricketMatches() {
  const json = await request('GET', '/esid', { query: { sid: CRICKET_SID } });
  if (!json?.success) throw new Error(`Diamond /esid: ${json?.msg || json?.message || 'failed'}`);
  return { real: json.data?.t1 || [], virtual: json.data?.t2 || [] };
}

/** Every market (Match Odds, Bookmaker, fancy, …) with current prices for one match. */
async function matchMarkets(gmid) {
  const json = await request('GET', '/getPriveteData', { query: { gmid, sid: CRICKET_SID } });
  if (!json?.success) throw new Error(`Diamond /getPriveteData ${gmid}: ${json?.msg || json?.message || 'failed'}`);
  return json.data || [];
}

/** Tells Diamond a market has bets on it, so its result gets declared to us. */
const registerPlacedBets = (payload) => request('POST', '/placed_bets', { body: payload });

/** The declared result of a market, or `{ message: 'result is not declared yet' }`. */
const marketResult = (payload) => request('POST', '/get-result', { body: payload });

module.exports = { isConfigured, cricketMatches, matchMarkets, registerPlacedBets, marketResult, CRICKET_SID };
