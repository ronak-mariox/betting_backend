const mongoose = require('mongoose');
const { MARKET_STATUSES } = require('../constants/admin');

const { Schema } = mongoose;

/** A betting market on an Event (Match Odds, Bookmaker, Fancy, …). */
const marketSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, trim: true, default: 'Match Odds' },
    backOdds: { type: Number, default: 0 },
    layOdds: { type: Number, default: 0 },
    maxBet: { type: Number, default: 0 },
    maxExposure: { type: Number, default: 0 },
    status: { type: String, enum: MARKET_STATUSES, default: 'Active', index: true },
    /**
     * Selections players can back, each with its own price. Markets created
     * without them fall back to the event's two sides priced at back/lay odds
     * (see playerBet.service.js#runnersFor).
     */
    runners: {
      type: [
        {
          _id: false,
          name: { type: String, required: true, trim: true },
          odds: { type: Number, required: true, min: 1.01 },
          /** False while the provider has this selection suspended (no bets on it). */
          active: { type: Boolean, default: true },
          /** Provider's selection id (Diamond section `sid`). */
          externalId: { type: String, default: null },
        },
      ],
      default: [],
    },
    /** Set when an admin settles the market. */
    winner: { type: String, trim: true, default: '' },
    settledAt: { type: Date, default: null },
    /** Provider's market id (Diamond `mid`) and raw market type (`MATCH_ODDS`, `Bookmaker`, `fancy1`, …). */
    externalId: { type: String, default: null, index: true },
    providerType: { type: String, default: '' },
    /** When the feed last refreshed this market's prices (null for manual markets). */
    oddsAt: { type: Date, default: null },
    /** Set when an admin suspends the market, so the feed sync doesn't reopen it. */
    adminSuspended: { type: Boolean, default: false },
    /** When Diamond was told this market has bets (so it declares the result to us). */
    resultRegisteredAt: { type: Date, default: null },
    /** Last raw answer from Diamond's result endpoint, for the admin to see. */
    lastResult: { type: String, default: '' },
    lastResultAt: { type: Date, default: null },
    /** Cached rollups from this market's bets. */
    bets: { type: Number, default: 0 },
    stake: { type: Number, default: 0 },
    exposure: { type: Number, default: 0 },
  },
  { timestamps: true },
);

marketSchema.index({ event: 1, status: 1 });

/** Live updates: an admin opening, suspending or settling a market reaches the apps at once (see realtime.js). */
function announceList() {
  // eslint-disable-next-line global-require
  require('../realtime').emitMatchesChanged();
}
marketSchema.post('save', announceList);
marketSchema.post('findOneAndUpdate', announceList);

module.exports = mongoose.model('Market', marketSchema);
