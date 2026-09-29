const mongoose = require('mongoose');
const { ROLE_ORDER } = require('../constants/roles');
const { TICKET_STATUSES, TICKET_PRIORITIES } = require('../constants/admin');

const { Schema } = mongoose;

const ticketMessageSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    fromSupport: { type: Boolean, default: false },
    body: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** A support ticket with its embedded message thread. */
const ticketSchema = new Schema(
  {
    subject: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'General' },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ROLE_ORDER, default: 'player' },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'Medium', index: true },
    status: { type: String, enum: TICKET_STATUSES, default: 'Open', index: true },
    assignedTeam: { type: String, trim: true, default: 'General' },
    messages: { type: [ticketMessageSchema], default: [] },
  },
  { timestamps: true },
);

ticketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
