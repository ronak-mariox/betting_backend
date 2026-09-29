const mongoose = require('mongoose');
const { EVENT_STATUSES } = require('../constants/admin');

const { Schema } = mongoose;

/** A sporting fixture — unifies what the Betting board calls a "Match" and the Events page calls a "SportEvent". */
const eventSchema = new Schema(
  {
    sport: { type: String, required: true, trim: true, index: true },
    league: { type: String, trim: true, default: '' },
    name: { type: String, required: true, trim: true },
    emoji: { type: String, default: '🏆' },
    score: { type: String, trim: true, default: '' },
    startTime: { type: Date, required: true, index: true },
    status: { type: String, enum: EVENT_STATUSES, default: 'Upcoming', index: true },
    /** Cached rollups from this event's markets/bets, refreshed on bet placement/settlement. */
    stake: { type: Number, default: 0 },
    exposure: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Event', eventSchema);
