const mongoose = require('mongoose');
const { COMMISSION_LEVELS, COMMISSION_STATUSES } = require('../constants/admin');

const { Schema } = mongoose;

/**
 * Commission an entity (franchise / super-agent / agent) earned in a period,
 * e.g. "2026-09". A period has one open (Pending) row that follows the bets
 * placed since the last settlement, plus a row for each settlement already paid.
 */
const commissionSchema = new Schema(
  {
    entity: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    level: { type: String, enum: COMMISSION_LEVELS, required: true },
    period: { type: String, required: true, trim: true },
    /** Bets placed from this moment on count towards the row (period start, or the previous settlement). */
    from: { type: Date, default: null },
    turnover: { type: Number, default: 0 },
    /** Percent, e.g. 5 = 5%. */
    rate: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    status: { type: String, enum: COMMISSION_STATUSES, default: 'Pending', index: true },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

commissionSchema.index({ entity: 1, period: 1, status: 1 });

module.exports = mongoose.model('Commission', commissionSchema);
