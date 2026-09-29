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
      type: [{ _id: false, name: { type: String, required: true, trim: true }, odds: { type: Number, required: true, min: 1.01 } }],
      default: [],
    },
    /** Set when an admin settles the market. */
    winner: { type: String, trim: true, default: '' },
    settledAt: { type: Date, default: null },
    /** Cached rollups from this market's bets. */
    bets: { type: Number, default: 0 },
    stake: { type: Number, default: 0 },
    exposure: { type: Number, default: 0 },
  },
  { timestamps: true },
);

marketSchema.index({ event: 1, status: 1 });

module.exports = mongoose.model('Market', marketSchema);
