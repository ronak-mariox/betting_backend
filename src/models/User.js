const mongoose = require('mongoose');
const { ROLE_ORDER } = require('../constants/roles');
const { COMMISSION_TYPES, SETTLEMENT_CYCLES, KYC_STATUSES } = require('../constants/admin');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 4,
      maxlength: 32,
      match: /^[a-z0-9_]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ROLE_ORDER,
      index: true,
    },
    /** Direct parent in the staff hierarchy (or the agent for a player, if assigned). Null for the root super-admin and for un-assigned players. */
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    /** Who provisioned this account. Null for self-registered players and the seeded root super-admin. */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    dob: { type: Date, default: null },
    /**
     * Profile photo as a data URI ("data:image/jpeg;base64,..."), picked
     * client-side and resized/compressed before upload. The 2MB cap here is
     * on the base64 text itself (~1.5MB of actual image data), generous
     * headroom over the ~150-300KB a resized photo typically produces.
     */
    avatar: { type: String, default: '', maxlength: 2_000_000 },
    /** Player-only KYC state: 'Not Submitted' until documents arrive, then 'Pending' review → Verified/Rejected. */
    kyc: {
      type: String,
      enum: KYC_STATUSES,
      default: 'Not Submitted',
    },
    /** Players and agents: this account's own referral code. A player's earns the sign-up bonus; an agent's places new players on its panel. */
    referralCode: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    /** Player-only: the account whose referral code was used at sign-up, if any. */
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    lastLoginAt: { type: Date, default: null },
    /** Bumped whenever the password changes, so tokens issued earlier stop verifying. */
    passwordChangedAt: { type: Date, default: null },
    /** Panel notification/display toggles from Profile → Preferences, keyed by setting label. */
    preferences: { type: Map, of: Boolean, default: {} },
    /** Live cash balance, in rupees. Moved only via wallet.service.js (requests, manual entries, transfers). */
    walletBalance: { type: Number, default: 0 },

    /** Staff-only: trading name shown in the panel, e.g. "Mumbai Franchise" (the person's own name stays in `name`). */
    businessName: { type: String, trim: true, default: '' },
    /** Staff-only: credit extended to this account, in rupees. */
    creditLimit: { type: Number, min: 0, default: 0 },
    /** Staff-only: commission percent for this account; null falls back to Settings.commissionRates for its role. */
    commissionRate: { type: Number, min: 0, max: 100, default: null },
    commissionType: { type: String, enum: COMMISSION_TYPES, default: 'Flat' },
    /** Staff-only: max single-bet stake allowed across this account's book, in rupees (0 = platform default). */
    bettingLimit: { type: Number, min: 0, default: 0 },
    /** Staff-only: max open exposure allowed across this account's book, in rupees (0 = platform default). */
    maxExposure: { type: Number, min: 0, default: 0 },
    settlementCycle: { type: String, enum: SETTLEMENT_CYCLES, default: 'Weekly' },
    /** Staff-only share and commission splits (percent), as captured by the Create Franchise form. */
    shareHolding: { type: Number, min: 0, max: 100, default: null },
    matchCommission: { type: Number, min: 0, max: 100, default: null },
    myMatchCommission: { type: Number, min: 0, max: 100, default: null },
    sessionCommission: { type: Number, min: 0, max: 100, default: null },
    mySessionCommission: { type: Number, min: 0, max: 100, default: null },
  },
  { timestamps: true },
);

userSchema.index({ parent: 1, role: 1 });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
