const mongoose = require('mongoose');
const { ROLE_ORDER } = require('../constants/roles');
const { NOTIFICATION_CATEGORIES, NOTIFICATION_LINKS } = require('../constants/admin');

const { Schema } = mongoose;

/**
 * Two feeds share this collection, both written by notification.service.js
 * from other modules (never created directly by a route):
 *  - the admin panel's, addressed to a role (`recipientRole`, no `recipient`);
 *  - a player's own in the app, addressed to that account (`recipient`).
 */
const notificationSchema = new Schema(
  {
    recipientRole: { type: String, enum: ROLE_ORDER, default: 'super-admin', index: true },
    /** The player this row belongs to; null on the admin feed. */
    recipient: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    emoji: { type: String, default: '🔔' },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: '' },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, default: 'general', index: true },
    /** Where tapping it leads in the app. */
    link: { type: String, enum: NOTIFICATION_LINKS, default: '' },
    /** What it's about ("req:<id>", "bet:<id>", "cms:<id>"), so the same thing is never announced twice. */
    source: { type: String },
    unread: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index(
  { recipient: 1, source: 1 },
  { unique: true, partialFilterExpression: { source: { $type: 'string' } } },
);

module.exports = mongoose.model('Notification', notificationSchema);
