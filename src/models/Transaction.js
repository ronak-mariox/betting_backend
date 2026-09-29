const mongoose = require('mongoose');
const { TRANSACTION_TYPES, TRANSACTION_STATUSES } = require('../constants/admin');

const { Schema } = mongoose;

/** The ledger of record: wallet requests, manual entries, bet settlements, commission and partner payments all write here. */
const transactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true, index: true },
    /** Signed rupee amount — negative for money leaving the platform/user. */
    amount: { type: Number, required: true },
    method: { type: String, trim: true, default: '' },
    reference: { type: String, trim: true, default: '' },
    status: { type: String, enum: TRANSACTION_STATUSES, default: 'Completed', index: true },
    relatedBet: { type: Schema.Types.ObjectId, ref: 'Bet', default: null },
    relatedPartner: { type: Schema.Types.ObjectId, ref: 'Partner', default: null },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
