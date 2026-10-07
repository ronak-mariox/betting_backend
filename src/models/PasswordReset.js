const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * One pending "Forgot password?" code per user. Only a hash of the 6-digit
 * code is stored; it dies after a few wrong guesses, after use, or at
 * expiresAt (the TTL index then clears the row).
 */
const passwordResetSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    ip: { type: String, default: '' },
  },
  { timestamps: true },
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
