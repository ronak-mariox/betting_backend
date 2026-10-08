const env = require('../config/env');
const Event = require('../models/Event');
const Market = require('../models/Market');
const Bet = require('../models/Bet');
const diamond = require('./diamond.client');
const notificationService = require('./notification.service');
const ApiProvider = require('../models/ApiProvider');
const realtime = require('../realtime');

const PROVIDER_NAME = 'Diamond (Cricket)';
/** Outcome of the last few match-list calls, for the provider card's uptime figure. */
const recentCalls = [];

/**
 * Keeps Events / Markets in step with the Diamond cricket feed:
 *  - the match list (real fixtures only; virtual / e-cricket are skipped),
 *  - prices for each match's back markets: Match Odds, Tied Match,
 *    Bookmaker (its "rate" turned into decimal odds) and fancy1 props,
 *  - results: markets with bets are registered with Diamond and polled
 *    until it declares a winner, then settled (or voided) the usual way.
 *
 * Session markets (Normal fancy, meter, khado, odd-even) are Yes/No-on-a-line
 * bets the platform can't take yet, so they are not imported.
 *
 * An admin's suspension (Event/Market.adminSuspended) always wins over the
 * feed, and settled markets are never touched.
 */

const SPORT = 'Cricket';
const MARKET_TYPES = { match: 'Match Odds', match1: 'Bookmaker', fancy1: 'Fancy' };
/** A fixture missing from this many list syncs in a row is treated as finished. */
const MISSES_TO_FINISH = 3;

const missCount = new Map();
const lastOddsAt = new Map();

// ------------------------------------------------------------------ parsing

/** Diamond start times are India time, "10/9/2026 7:00:00 PM". */
function parseStartTime(stime) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) ?(AM|PM)$/i.exec(String(stime || '').trim());
  if (!m) return new Date();
  let hour = Number(m[4]) % 12;
  if (m[7].toUpperCase() === 'PM') hour += 12;
  const utc = Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), hour, Number(m[5]), Number(m[6]));
  return new Date(utc - 330 * 60 * 1000);
}

const titleCase = (s) => String(s).toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const backPrice = (section) => Number(section.odds?.find((o) => o.oname === 'back1')?.odds ?? section.odds?.find((o) => o.otype === 'back')?.odds) || 0;

const sectionOpen = (section) => !/SUSPEND|CLOSED|BALL|INACTIVE/i.test(section.gstatus || '');

/** Bookmaker prices come as a "rate" (24 = 1.24 in decimal odds). */
const toDecimal = (gtype, price) => (gtype === 'match1' ? (price > 0 ? 1 + price / 100 : 0) : price);

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Diamond market → the markets this platform stores. A Match Odds style
 * market maps 1:1; a fancy1 market holds independent propositions
 * ("IND Will Win Toss"), each becoming its own one-selection market.
 */
function mapMarkets(raw) {
  const out = [];
  for (const m of raw) {
    const type = MARKET_TYPES[m.gtype];
    if (!type) continue; // session markets: not supported yet
    const marketOpen = /OPEN|ACTIVE/i.test(m.status || '');
    if (m.gtype === 'fancy1') {
      for (const section of m.section || []) {
        const price = backPrice(section);
        out.push({
          externalId: `${m.mid}:${section.sid}`,
          providerType: m.gtype,
          code: `DMD-${m.mid}-${section.sid}`,
          name: section.nat,
          type,
          open: marketOpen && sectionOpen(section) && price >= 1.01,
          maxBet: Number(section.max) || 0, // per-proposition stake cap from the feed
          runners: [{ name: 'Yes', price, active: sectionOpen(section) && price >= 1.01, externalId: String(section.sid) }],
        });
      }
      continue;
    }
    const runners = (m.section || []).map((section) => {
      const price = round2(toDecimal(m.gtype, backPrice(section)));
      return { name: section.nat, price, active: sectionOpen(section) && price >= 1.01, externalId: String(section.sid) };
    });
    if (runners.length < 2) continue;
    out.push({
      externalId: String(m.mid),
      providerType: m.gtype,
      code: `DMD-${m.mid}`,
      name: m.mname === 'MATCH_ODDS' ? 'Match Odds' : m.gtype === 'match1' ? 'Bookmaker' : titleCase(m.mname),
      type,
      open: marketOpen,
      maxBet: Number(m.max) || 0, // feed's stake cap (`maxb` is only a flag)
      runners,
    });
  }
  return out;
}

// --------------------------------------------------------------- the match list

const isRealFixture = (m) => Number(m.iscc) === 0 && !/\(e\)|virtual|dim cricket/i.test(`${m.ename} ${m.cname}`);

/** Records how the feed answered on the Betting page's provider card (and the dashboard health). */
async function recordHealth(ok, latency) {
  recentCalls.push(ok);
  if (recentCalls.length > 100) recentCalls.shift();
  const uptime = Math.round((recentCalls.filter(Boolean).length / recentCalls.length) * 1000) / 10;
  const marketsCount = await Market.countDocuments({ externalId: { $ne: null }, status: 'Active' });
  await ApiProvider.updateOne(
    { name: PROVIDER_NAME },
    {
      $set: {
        status: ok ? 'Connected' : 'Disconnected',
        healthy: ok,
        uptime,
        marketsCount,
        ...(ok ? { latency, lastSyncAt: new Date() } : {}),
      },
    },
    { upsert: true },
  );
}

async function syncMatchList() {
  const started = Date.now();
  let real;
  try {
    ({ real } = await diamond.cricketMatches());
  } catch (err) {
    await recordHealth(false).catch(() => null);
    throw err;
  }
  await recordHealth(true, Date.now() - started).catch(() => null);
  const fixtures = real.filter(isRealFixture);
  const seen = new Set();

  for (const m of fixtures) {
    const externalId = String(m.gmid);
    seen.add(externalId);
    missCount.delete(externalId);
    // eslint-disable-next-line no-await-in-loop
    const existing = await Event.findOne({ provider: 'diamond', externalId });
    if (existing && ['Completed', 'Settled'].includes(existing.status)) continue;

    const wanted = existing?.adminSuspended ? 'Suspended' : m.iplay ? 'Live' : 'Upcoming';
    const fields = {
      sport: SPORT,
      league: m.cname || '',
      name: String(m.ename || '').replace(/\s+/g, ' ').trim(),
      emoji: '🏏',
      startTime: parseStartTime(m.stime),
      status: wanted,
      hasStream: Boolean(m.tv),
      syncedAt: new Date(),
    };
    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      const created = await Event.create({ ...fields, provider: 'diamond', externalId });
      realtime.emitMatchesChanged();
      if (created.status === 'Live') await notificationService.notifyMatchLive(created).catch(() => null); // eslint-disable-line no-await-in-loop
    } else {
      const wentLive = existing.status !== 'Live' && wanted === 'Live';
      if (existing.status !== wanted) realtime.emitMatchesChanged();
      existing.set(fields);
      // eslint-disable-next-line no-await-in-loop
      await existing.save();
      if (wentLive) await notificationService.notifyMatchLive(existing).catch(() => null); // eslint-disable-line no-await-in-loop
    }
  }

  // Fixtures that dropped off the feed are over. A single empty or failed
  // answer must not close everything, so it takes a few misses in a row.
  if (!fixtures.length) return { fixtures: 0 };
  const open = await Event.find({ provider: 'diamond', status: { $in: ['Live', 'Upcoming', 'Suspended'] } });
  for (const event of open) {
    if (seen.has(event.externalId)) continue; // eslint-disable-line no-continue
    const misses = (missCount.get(event.externalId) || 0) + 1;
    missCount.set(event.externalId, misses);
    if (misses < MISSES_TO_FINISH) continue; // eslint-disable-line no-continue
    missCount.delete(event.externalId);
    event.status = 'Completed';
    // eslint-disable-next-line no-await-in-loop
    await event.save();
    realtime.emitMatchesChanged();
    // eslint-disable-next-line no-await-in-loop
    await Market.updateMany({ event: event._id, status: 'Active' }, { $set: { status: 'Suspended' } });
  }
  return { fixtures: fixtures.length };
}

// ---------------------------------------------------------------------- odds

async function syncEventOdds(event) {
  const mapped = mapMarkets(await diamond.matchMarkets(event.externalId));
  const now = new Date();
  const seen = new Set();
  const eventOpen = event.status === 'Live' || event.status === 'Upcoming';

  const stored = new Map(
    (await Market.find({ event: event._id, externalId: { $ne: null } })).map((doc) => [doc.externalId, doc]),
  );
  const changed = []; // pushed to clients as { _id, name, type, status, maxBet, runners }
  let listChanged = false; // a market opened, closed or appeared: clients refetch the list

  for (const m of mapped) {
    seen.add(m.externalId);
    const existing = stored.get(m.externalId);
    if (existing?.winner) continue; // settled: frozen
    // A price must stay ≥ 1.01 to be stored; a suspended selection keeps its last good price.
    const runners = m.runners.map((r) => {
      const prev = existing?.runners?.find((p) => p.externalId === r.externalId || p.name === r.name);
      return {
        name: r.name,
        odds: r.price >= 1.01 ? r.price : prev?.odds || 1.01,
        active: r.active,
        externalId: r.externalId,
      };
    });
    const status = m.open && eventOpen && !existing?.adminSuspended ? 'Active' : 'Suspended';
    const fields = {
      name: m.name,
      type: m.type,
      providerType: m.providerType,
      runners,
      backOdds: runners[0]?.odds || 0,
      layOdds: runners[1]?.odds || 0,
      status,
      ...(m.maxBet > 0 ? { maxBet: m.maxBet } : {}),
    };
    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await Market.create({ event: event._id, externalId: m.externalId, code: m.code, oddsAt: now, ...fields });
      if (status === 'Active') listChanged = true;
      continue; // eslint-disable-line no-continue
    }
    const priceKey = (rs) => rs.map((r) => `${r.name}|${r.odds}|${r.active !== false}`).join(';');
    const differs =
      existing.status !== status ||
      existing.name !== fields.name ||
      priceKey(existing.runners) !== priceKey(runners) ||
      (fields.maxBet !== undefined && existing.maxBet !== fields.maxBet);
    if (!differs) continue; // eslint-disable-line no-continue
    if (existing.status !== status) listChanged = true;
    // eslint-disable-next-line no-await-in-loop
    await Market.updateOne({ _id: existing._id }, { $set: fields });
    changed.push({ _id: String(existing._id), name: fields.name, type: fields.type, status, maxBet: fields.maxBet ?? existing.maxBet, runners: runners.map(({ name, odds, active }) => ({ name, odds, active })) });
  }

  // Unchanged prices are still fresh prices: one write keeps every market's oddsAt current.
  await Market.updateMany({ event: event._id, externalId: { $in: [...seen] } }, { $set: { oddsAt: now } });

  // Markets the feed no longer offers are closed for betting (never deleted: bets may sit on them).
  const closed = await Market.updateMany(
    { event: event._id, externalId: { $ne: null, $nin: [...seen] }, status: 'Active', winner: { $in: ['', null] } },
    { $set: { status: 'Suspended' } },
  );
  if (closed.modifiedCount) listChanged = true;

  realtime.emitOdds(event._id, changed);
  if (listChanged) realtime.emitMatchesChanged();
  lastOddsAt.set(String(event._id), Date.now());
  return mapped.length;
}

/** Live matches every few seconds, upcoming ones about once a minute. */
async function syncDueOdds() {
  const events = await Event.find({ provider: 'diamond', status: { $in: ['Live', 'Upcoming', 'Suspended'] } });
  const now = Date.now();
  await Promise.all(
    events
      .filter((e) => now - (lastOddsAt.get(String(e._id)) || 0) >= (e.status === 'Live' ? env.diamond.liveOddsMs : env.diamond.upcomingOddsMs))
      .map((e) => syncEventOdds(e).catch((err) => console.error(`diamond odds ${e.externalId}:`, err.message))), // eslint-disable-line no-console
  );
}

// ------------------------------------------------------------------- results

/** What Diamond expects to identify a market (fancy propositions go by their own name). */
const resultPayload = (event, market) => ({
  event_id: Number(event.externalId),
  event_name: event.name,
  market_id: Number(String(market.externalId).split(':')[0]),
  market_name: market.name,
  market_type: market.providerType === 'fancy1' ? 'FANCY' : market.providerType === 'match1' ? 'BOOKMAKER' : 'MATCH_ODDS',
});

/** Pulls a winner out of whatever shape the result comes in. */
function readResult(json) {
  const candidates = [json?.result, json?.data?.result, json?.winner, json?.data?.winner, json?.data?.nat, json?.data]
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .map((v) => String(v).trim())
    .filter(Boolean);
  return candidates[0] || null;
}

const VOID_WORDS = /abandon|cancel|void|no result|refund/i;

async function settleFromResult(event, market) {
  // eslint-disable-next-line global-require
  const playerBet = require('./playerBet.service');
  const payload = resultPayload(event, market);
  if (!market.resultRegisteredAt) {
    await diamond.registerPlacedBets(payload);
    await Market.updateOne({ _id: market._id }, { $set: { resultRegisteredAt: new Date() } });
  }
  const json = await diamond.marketResult(payload);
  await Market.updateOne({ _id: market._id }, { $set: { lastResult: JSON.stringify(json).slice(0, 500), lastResultAt: new Date() } });
  if (/not declared/i.test(json?.message || '')) return 'pending';

  const result = readResult(json);
  if (!result) return 'unreadable';
  if (VOID_WORDS.test(result)) {
    await playerBet.voidMarket(market._id, `Diamond: ${result}`);
    return 'voided';
  }
  const runner = market.runners.find((r) => r.name.toLowerCase() === result.toLowerCase());
  if (runner) {
    await playerBet.settleMarket(market._id, runner.name);
    return 'settled';
  }
  // A one-selection proposition ("Yes") that did not happen: every bet on it loses.
  if (market.providerType === 'fancy1' && /^(no|false|0)$/i.test(result)) {
    await playerBet.settleMarket(market._id, 'No', { allowUnlisted: true });
    return 'settled';
  }
  return 'unmatched'; // left for the admin to settle by hand; lastResult shows what came back
}

async function syncResults() {
  const openMarkets = await Market.find({ externalId: { $ne: null }, winner: { $in: ['', null] } }).select('_id event').lean();
  if (!openMarkets.length) return;
  const withBets = new Set((await Bet.distinct('market', { market: { $in: openMarkets.map((m) => m._id) }, status: 'Pending' })).map(String));
  const markets = await Market.find({ _id: { $in: [...withBets] } });
  for (const market of markets) {
    // eslint-disable-next-line no-await-in-loop
    const event = await Event.findById(market.event);
    if (!event || event.provider !== 'diamond') continue; // eslint-disable-line no-continue
    try {
      // eslint-disable-next-line no-await-in-loop
      await settleFromResult(event, market);
    } catch (err) {
      console.error(`diamond result ${market.externalId}:`, err.message); // eslint-disable-line no-console
    }
  }
}

// ----------------------------------------------------------------- scheduler

const timers = [];

function every(ms, task, label) {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await task();
    } catch (err) {
      console.error(`diamond ${label} failed:`, err.message); // eslint-disable-line no-console
    } finally {
      busy = false;
    }
  };
  run();
  const timer = setInterval(run, ms);
  timer.unref?.();
  timers.push(timer);
}

/** Starts the feed (index.js). Does nothing without DIAMOND_API_KEY. */
function start() {
  if (!diamond.isConfigured() || timers.length) return false;
  every(env.diamond.matchListMs, syncMatchList, 'match list');
  every(Math.min(env.diamond.liveOddsMs, env.diamond.upcomingOddsMs), syncDueOdds, 'odds');
  every(env.diamond.resultsMs, syncResults, 'results');
  console.log('Diamond cricket feed sync started'); // eslint-disable-line no-console
  return true;
}

/** The embeddable score card / video for a feed match (null for manual events). */
function mediaFor(event) {
  if (event.provider !== 'diamond' || !event.externalId) return { scoreUrl: null, streamUrl: null };
  return {
    scoreUrl: `${env.diamond.scoreUrl}${event.externalId}`,
    streamUrl: event.hasStream ? `${env.diamond.streamUrl}${event.externalId}` : null,
  };
}

/** "Sync All" on the Betting page: refresh the list and every open match's prices now. */
async function syncNow() {
  await syncMatchList();
  const events = await Event.find({ provider: 'diamond', status: { $in: ['Live', 'Upcoming', 'Suspended'] } });
  await Promise.all(events.map((e) => syncEventOdds(e).catch(() => null)));
}

module.exports = {
  start,
  syncNow,
  syncMatchList,
  syncEventOdds,
  syncDueOdds,
  syncResults,
  mapMarkets,
  parseStartTime,
  readResult,
  mediaFor,
  isRealFixture,
};
