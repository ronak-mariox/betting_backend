const mongoose = require('mongoose');

const { Schema } = mongoose;

/** Risk panel: a detected suspicious betting/wallet pattern, possibly involving several users. */
const suspiciousPatternSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    relatedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    severity: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium', index: true },
    detectedAt: { type: Date, default: Date.now },
    resolved: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SuspiciousPattern', suspiciousPatternSchema);
