const mongoose = require('mongoose');
const { KYC_DOCUMENT_TYPES } = require('../constants/admin');

const { Schema } = mongoose;

/** One uploaded document image, kept as a data URI like User.avatar. */
const fileSchema = new Schema(
  {
    name: { type: String, trim: true, default: '' },
    mime: { type: String, trim: true, default: '' },
    data: { type: String, required: true },
  },
  { _id: false },
);

/**
 * A player's KYC submission from the app (Personal → Document → Review).
 * The latest one per user drives User.kyc; older ones stay as history.
 * Images are large — list queries should exclude `front.data` / `back.data`.
 */
const kycSubmissionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referenceId: { type: String, required: true, unique: true },
    fullName: { type: String, required: true, trim: true },
    /** 10-digit Indian mobile ('' on submissions made before the field existed). */
    phone: { type: String, trim: true, default: '' },
    dob: { type: Date, required: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, trim: true, default: 'India' },
    postalCode: { type: String, required: true, trim: true },
    documentType: { type: String, enum: KYC_DOCUMENT_TYPES, required: true },
    documentNumber: { type: String, required: true, trim: true },
    front: { type: fileSchema, required: true },
    back: { type: fileSchema, default: null },
    status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending', index: true },
    rejectionReason: { type: String, trim: true, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

kycSubmissionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('KycSubmission', kycSubmissionSchema);
