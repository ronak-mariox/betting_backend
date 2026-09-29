const mongoose = require('mongoose');

const { Schema } = mongoose;

/** A disbursement out of the platform — commission payout or ad-hoc payment to a staff account or Partner. */
const paymentSchema = new Schema(
  {
    recipientType: { type: String, enum: ['User', 'Partner'], required: true },
    recipient: { type: Schema.Types.ObjectId, required: true, refPath: 'recipientType' },
    paymentType: { type: String, trim: true, default: 'Payment' },
    method: { type: String, trim: true, default: '' },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Completed' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
