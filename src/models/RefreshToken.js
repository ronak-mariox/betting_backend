const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Refresh tokens are never stored in plaintext — only a sha256 hash of the
 * opaque token the client holds. Rotation: each successful /refresh revokes
 * the token used and issues a brand new one, recording the chain via
 * replacedByHash so a reused (stolen) token can be detected.
 */
const refreshTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
