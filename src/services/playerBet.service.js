const mongoose = require('mongoose');
const { loadTree, descendants } = require('./tree.service');
const Event = require('../models/Event');
const Market = require('../models/Market');
const Bet = require('../models/Bet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WalletRequest = require('../models/WalletRequest');
const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');
const notificationService = require('./notification.service');
const { ENABLED_SPORTS } = require('../constants/admin');

/** How fresh a feed market's prices must be to take a bet on them. */
const FEED_LIVE_MAX_AGE_MS = 20 * 1000;
const FEED_UPCOMING_MAX_AGE_MS = 5 * 60 * 1000;

/** Cash-out offers keep a 5% margin, like the app's design copy implies. */
const CASH_OUT_MARGIN = 0.95;

const sides = (eventName) => {
  const [home, away] = String(eventName).split(/\s+(?:vs\.?|v\.?|-)\s+/i);
  return { home: home || eventName, away: away || 'Draw' };
};

/**
 * A market's backable selections. Markets without explicit runners fall back
 * to the event's two sides, priced at the market's back / lay odds.
 */
function runnersFor(market, event) {
  if (market.runners?.length) return market.runners.map((r) => ({ name: r.name, odds: r.odds, active: r.active !== false }));
  const { home, away } = sides(event.name);
  return [
    { name: home, odds: market.backOdds || 2 },
    { name: away, odds: market.layOdds || 2 },
  ];
}

/**
 * Stake tied up in the player's open bets plus withdrawals awaiting approval.
 * Bets don't debit the wallet until they settle, so this is what's "reserved".
 */
async function reservedFor(userId) {
  const [bets, withdrawals] = await Promise.all([
    Bet.aggregate([{ $match: { user: userId, status: 'Pending' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    WalletRequest.aggregate([
      { $match: { user: userId, kind: 'withdrawal', status: 'Pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  return { openStake: bets[0]?.total || 0, pendingWithdrawal: withdrawals[0]?.total || 0 };
}

/** The player's agent, super agent and franchise (nearest first) with the limits set on them. */
async function uplinesOf(user) {
  const chain = [];
  let parentId = user.parent;
  while (parentId && chain.length < 5) {
    // eslint-disable-next-line no-await-in-loop
    const parent = await User.findById(parentId).select('parent role bettingLimit maxExposure').lean();
    if (!parent || parent.role === 'super-admin') break;
    chain.push(parent);
    parentId = parent.parent;
  }
  return chain;
}

/** Stake riding on open bets across everyone under a staff account. */
async function bookExposure(staffId) {
  const tree = await loadTree();
  const ids = descendants(tree, staffId).map((id) => new mongoose.Types.ObjectId(id));
  const [row] = await Bet.aggregate([{ $match: { user: { $in: ids }, status: 'Pending' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  return row?.total || 0;
}

async function availableFor(user) {
  const { openStake, pendingWithdrawal } = await reservedFor(user._id);
  return Math.max(0, user.walletBalance - openStake - pendingWithdrawal);
}

/** Match Odds first (the card's headline prices), then Bookmaker, Tied Match, Fancy; ties by creation order. */
const MARKET_RANK = { 'Match Odds': 0, Bookmaker: 1, Fancy: 3 };
const marketRank = (m) => (m.name === 'Tied Match' ? 2 : MARKET_RANK[m.type] ?? 4);
const marketOrder = (a, b) => marketRank(a) - marketRank(b) || new Date(a.createdAt) - new Date(b.createdAt);

const toMatch = (event, markets) => ({
  _id: event._id,
  sport: event.sport,
  emoji: event.emoji,
  league: event.league,
  name: event.name,
  ...sides(event.name),
  score: event.score,
  status: event.status,
  startTime: event.startTime,
  markets: [...markets].sort(marketOrder).map((m) => ({ _id: m._id, name: m.name, type: m.type, maxBet: m.maxBet, runners: runnersFor(m, event) })),
  // Feed matches: embeddable live score card and (when the provider has one) video.
  // eslint-disable-next-line global-require
  ...require('./diamondSync.service').mediaFor(event),
});

/** Live and upcoming events with at least one open market — the app's match feed. */
async function listMatches() {
  // Only the sports open for betting reach the app (cricket for now).
  const events = await Event.find({ status: { $in: ['Live', 'Upcoming'] }, sport: { $in: ENABLED_SPORTS } }).sort({ status: 1, startTime: 1 }).lean();
  const markets = await Market.find({ event: { $in: events.map((e) => e._id) }, status: 'Active' }).lean();
  return events
    .map((event) => toMatch(event, markets.filter((m) => String(m.event) === String(event._id))))
    .filter((match) => match.markets.length > 0)
    // Live first, then soonest kickoff.
    .sort((a, b) => (a.status === b.status ? new Date(a.startTime) - new Date(b.startTime) : a.status === 'Live' ? -1 : 1));
}

async function getMatch(eventId) {
  const event = await Event.findById(eventId).lean();
  if (!event) throw ApiError.notFound('Match not found');
  const markets = await Market.find({ event: event._id, status: 'Active' }).lean();
  return toMatch(event, markets);
}

/**
 * Places a bet at the market's current price for `selection`. The stake must
 * fit the platform/market limits and the player's available balance (balance
 * minus open stakes and pending withdrawals); it's reserved, not debited.
 */
async function placeBet(player, { marketId, selection, stake }) {
  // Betting opens only once the player's identity is verified.
  const verified = await User.exists({ _id: player._id, kyc: 'Verified' });
  if (!verified) throw ApiError.forbidden('Bet lagane ke liye pehle KYC verify karwao');

  const amount = Math.round(Number(stake));
  const market = await Market.findById(marketId);
  if (!market || market.status !== 'Active') throw ApiError.badRequest('Yeh market abhi band hai');
  const event = await Event.findById(market.event);
  if (!event || !['Live', 'Upcoming'].includes(event.status)) throw ApiError.badRequest('Is match par betting band hai');

  const runner = runnersFor(market, event).find((r) => r.name === selection);
  if (!runner) throw ApiError.badRequest('Selection is market mein nahi hai');
  if (runner.active === false) throw ApiError.badRequest('Yeh selection abhi suspended hai');
  // Feed markets: never take a bet on prices the feed hasn't refreshed recently.
  if (market.externalId) {
    const maxAge = event.status === 'Live' ? FEED_LIVE_MAX_AGE_MS : FEED_UPCOMING_MAX_AGE_MS;
    if (!market.oddsAt || Date.now() - new Date(market.oddsAt).getTime() > maxAge) {
      throw ApiError.badRequest('Odds update ho rahe hain — thodi der baad try karo');
    }
  }

  const user = await User.findById(player._id);
  const [settings, uplines] = await Promise.all([Settings.findById('main').lean(), uplinesOf(user)]);
  const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const positive = (...values) => values.map(Number).filter((n) => Number.isFinite(n) && n > 0);

  // Stake per bet: platform limits, the market's own cap, and any "Betting
  // Limit per User" set on the player's agent / super agent / franchise.
  const minBet = Number(settings?.bettingLimits?.minBet) || 100;
  const maxBet = Math.min(...positive(settings?.bettingLimits?.maxBet, market.maxBet, ...uplines.map((u) => u.bettingLimit)), Infinity);
  if (amount < minBet) throw ApiError.badRequest(`Minimum stake ${rupees(minBet)} hai`);
  if (amount > maxBet) throw ApiError.badRequest(`Maximum stake ${rupees(maxBet)} hai`);

  if (amount > (await availableFor(user))) throw ApiError.badRequest('Wallet mein itna balance nahi hai');

  // Exposure: what this player, this market and each upline's book may have riding at once.
  const { openStake } = await reservedFor(user._id);
  const userCap = Math.min(...positive(settings?.exposureLimits?.maxUserExposure), Infinity);
  if (openStake + amount > userCap) {
    throw ApiError.badRequest(`Aapki open bets ki limit ${rupees(userCap)} hai — pehle koi bet settle hone do`);
  }
  const marketCap = Math.min(...positive(settings?.exposureLimits?.maxMarketExposure, market.maxExposure), Infinity);
  if ((market.exposure || 0) + amount > marketCap) throw ApiError.badRequest('Is market ki limit poori ho gayi hai');
  for (const upline of uplines.filter((u) => u.maxExposure > 0)) {
    // eslint-disable-next-line no-await-in-loop
    if ((await bookExposure(upline._id)) + amount > upline.maxExposure) {
      throw ApiError.badRequest('Aapke agent ki exposure limit poori ho gayi hai — agent se baat karo');
    }
  }

  const bet = await Bet.create({
    event: event._id,
    market: market._id,
    user: user._id,
    selection: runner.name,
    odds: runner.odds,
    amount,
    status: 'Pending',
  });

  // Two bets sent at the same moment both pass the check above; re-check with
  // this bet counted and take it back if together they overdraw the wallet.
  // Bets are honoured oldest first, so of several racing bets the first ones that fit stay.
  const [fresh, { pendingWithdrawal }, queue] = await Promise.all([
    User.findById(user._id).select('walletBalance'),
    reservedFor(user._id),
    Bet.find({ user: user._id, status: 'Pending' }).sort({ _id: 1 }).select('amount'),
  ]);
  let held = pendingWithdrawal;
  for (const open of queue) {
    held += open.amount;
    if (String(open._id) === String(bet._id)) break;
  }
  if (held > fresh.walletBalance) {
    await Bet.deleteOne({ _id: bet._id });
    throw ApiError.badRequest('Wallet mein itna balance nahi hai');
  }

  await Promise.all([
    Market.updateOne({ _id: market._id }, { $inc: { bets: 1, stake: amount, exposure: amount } }),
    Event.updateOne({ _id: event._id }, { $inc: { stake: amount, exposure: amount } }),
  ]);
  // Feed markets: the result sync registers it with Diamond; nothing here waits on the feed.
  return bet;
}

/** Current cash-out offer for an open bet: its value at today's price, less the margin. */
async function cashOutOffer(bet) {
  const market = await Market.findById(bet.market);
  const event = market && (await Event.findById(market.event));
  if (!market || market.status !== 'Active' || !event) return null;
  const current = runnersFor(market, event).find((r) => r.name === bet.selection)?.odds || bet.odds;
  return Math.round(((bet.amount * bet.odds) / current) * CASH_OUT_MARGIN);
}

async function listBets(player) {
  const bets = await Bet.find({ user: player._id }).populate('event', 'name').populate('market', 'name').sort({ createdAt: -1 }).limit(100);
  return Promise.all(
    bets.map(async (bet) => ({
      _id: bet._id,
      match: bet.event?.name || '',
      market: bet.market?.name || '',
      selection: bet.selection,
      odds: bet.odds,
      stake: bet.amount,
      status: bet.status,
      payout: bet.payout,
      placedAt: bet.createdAt,
      settledAt: bet.settledAt,
      cashOut: bet.status === 'Pending' ? await cashOutOffer(bet) : null,
    })),
  );
}

/** Closes an open bet now for the current offer; the ledger records the difference from the stake. */
async function cashOut(player, betId) {
  const open = await Bet.findOne({ _id: betId, user: player._id });
  if (!open) throw ApiError.notFound('Bet not found');
  if (open.status !== 'Pending') throw ApiError.conflict('Yeh bet already settle ho chuki hai');
  const offer = await cashOutOffer(open);
  if (offer === null) throw ApiError.badRequest('Is bet par abhi cash out available nahi hai');

  // Claimed only while still open, so a double tap (or a settlement landing
  // at the same moment) can't pay the bet twice.
  const bet = await Bet.findOneAndUpdate(
    { _id: betId, user: player._id, status: 'Pending' },
    { $set: { status: 'Cashed Out', payout: offer, settledAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!bet) throw ApiError.conflict('Yeh bet already settle ho chuki hai');

  const net = offer - bet.amount;
  await User.updateOne({ _id: player._id }, { $inc: { walletBalance: net } });
  await Transaction.create({
    user: player._id,
    type: net >= 0 ? 'Bet Win' : 'Bet Loss',
    amount: net,
    status: 'Completed',
    relatedBet: bet._id,
    note: `Cash out — ${bet.selection}`,
  });
  await Promise.all([
    Market.updateOne({ _id: bet.market }, { $inc: { exposure: -bet.amount } }),
    Event.updateOne({ _id: bet.event }, { $inc: { exposure: -bet.amount } }),
  ]);
  return { bet, offer };
}

/**
 * Admin settles a market with its winning selection: every open bet on it is
 * marked Won (profit credited as "Bet Win") or Lost (stake debited as "Bet
 * Loss"), and the market is closed.
 */
/**
 * `allowUnlisted` (feed results only): the winner may be an outcome nobody
 * could back, e.g. "No" on a one-selection "Yes" proposition — every bet loses.
 */
async function settleMarket(marketId, winner, { allowUnlisted = false } = {}) {
  const existing = await Market.findById(marketId);
  if (!existing) throw ApiError.notFound('Market not found');
  if (existing.winner) throw ApiError.conflict('Market already settled');
  const event = await Event.findById(existing.event);
  if (!allowUnlisted && !runnersFor(existing, event).some((r) => r.name === winner)) {
    throw ApiError.badRequest('Winner must be one of the market selections');
  }

  // Closing the market first (only if nobody else has) stops new bets and a second settlement.
  const market = await Market.findOneAndUpdate(
    { _id: marketId, winner: { $in: ['', null] } },
    { $set: { winner, settledAt: new Date(), status: 'Suspended' } },
    { returnDocument: 'after' },
  );
  if (!market) throw ApiError.conflict('Market already settled');

  const openBets = await Bet.find({ market: market._id, status: 'Pending' });
  const bets = [];
  let won = 0;
  let lost = 0;
  for (const open of openBets) {
    const isWin = open.selection === winner;
    const net = isWin ? Math.round(open.amount * (open.odds - 1)) : -open.amount;
    // Skips a bet the player cashed out in the meantime.
    // eslint-disable-next-line no-await-in-loop
    const bet = await Bet.findOneAndUpdate(
      { _id: open._id, status: 'Pending' },
      { $set: { status: isWin ? 'Won' : 'Lost', payout: isWin ? Math.round(open.amount * open.odds) : 0, settledAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!bet) continue; // eslint-disable-line no-continue
    bets.push(bet);
    // eslint-disable-next-line no-await-in-loop
    await User.updateOne({ _id: bet.user }, { $inc: { walletBalance: net } });
    // eslint-disable-next-line no-await-in-loop
    await Transaction.create({
      user: bet.user,
      type: isWin ? 'Bet Win' : 'Bet Loss',
      amount: net,
      status: 'Completed',
      relatedBet: bet._id,
      note: `${event.name} — ${market.name}: ${winner}`,
    });
    // eslint-disable-next-line no-await-in-loop
    await notificationService.notifyBetSettled(bet, event.name);
    if (isWin) won += 1;
    else lost += 1;
  }

  const openStake = bets.reduce((sum, b) => sum + b.amount, 0);
  market.exposure = 0;
  await market.save();
  await Event.updateOne({ _id: event._id }, { $inc: { exposure: -openStake } });
  return { market, settled: bets.length, won, lost };
}

/**
 * No result (abandoned match, wrong market): every open bet is voided and its
 * stake released — nothing was debited, so no ledger entry is needed. Claims
 * the market like a settlement does, so it can't be settled afterwards.
 */
async function voidMarket(marketId, reason = '') {
  const existing = await Market.findById(marketId);
  if (!existing) throw ApiError.notFound('Market not found');
  if (existing.winner) throw ApiError.conflict('Market already settled');
  const event = await Event.findById(existing.event);

  const market = await Market.findOneAndUpdate(
    { _id: marketId, winner: { $in: ['', null] } },
    { $set: { winner: 'Void', settledAt: new Date(), status: 'Suspended', exposure: 0 } },
    { returnDocument: 'after' },
  );
  if (!market) throw ApiError.conflict('Market already settled');

  const openBets = await Bet.find({ market: market._id, status: 'Pending' });
  let voided = 0;
  for (const open of openBets) {
    // eslint-disable-next-line no-await-in-loop
    const bet = await Bet.findOneAndUpdate(
      { _id: open._id, status: 'Pending' },
      { $set: { status: 'Void', payout: open.amount, settledAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!bet) continue; // eslint-disable-line no-continue
    voided += 1;
    // eslint-disable-next-line no-await-in-loop
    await notificationService.notifyPlayer({
      user: bet.user,
      category: 'bet',
      link: 'bets',
      source: `bet:${bet._id}`,
      emoji: '↩️',
      title: 'Bet Void',
      body: `${bet.selection} bet (${event?.name || market.name}) — ${reason || 'no result'}. Your ₹${bet.amount.toLocaleString('en-IN')} stake is released.`,
    });
  }
  const released = openBets.reduce((sum, b) => sum + b.amount, 0);
  if (event) await Event.updateOne({ _id: event._id }, { $inc: { exposure: -released } });
  return { market, voided, released };
}

module.exports = { runnersFor, reservedFor, availableFor, listMatches, getMatch, placeBet, listBets, cashOut, settleMarket, voidMarket };
