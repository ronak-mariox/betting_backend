const mongoose = require('mongoose');
const { BET_STATUSES } = require('../constants/admin');

const { Schema } = mongoose;

/** An individual bet placed on a Market. */
const betSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    market: { type: Schema.Types.ObjectId, ref: 'Market', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    selection: { type: String, required: true, trim: true },
    odds: { type: Number, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: BET_STATUSES, default: 'Pending', index: true },
    placedAt: { type: Date, default: Date.now },
    /** What the player got back: stake × odds when won, the cash-out offer when cashed out. */
    payout: { type: Number, default: 0 },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

betSchema.index({ createdAt: -1 });

/** Live updates: the owner's app and open panel pages refresh when bets change (see realtime.js). */
function announce(doc) {
  if (!doc) return;
  // eslint-disable-next-line global-require
  const realtime = require('../realtime');
  realtime.emitPlayerChanged(doc.user);
  realtime.emitStaffChanged('bets');
}
betSchema.post('save', announce);
betSchema.post('findOneAndUpdate', announce);
betSchema.post('insertMany', (docs) => [].concat(docs).forEach(announce));

module.exports = mongoose.model('Bet', betSchema);
