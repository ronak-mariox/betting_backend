const mongoose = require('mongoose');

const { Schema } = mongoose;

/** Connection status for an odds-feed provider. No real external calls are made — "sync" just refreshes these fields. */
const apiProviderSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    latency: { type: Number, default: 0 },
    marketsCount: { type: Number, default: 0 },
    uptime: { type: Number, default: 100 },
    status: { type: String, enum: ['Connected', 'Disconnected', 'Syncing'], default: 'Connected' },
    healthy: { type: Boolean, default: true },
    lastSyncAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ApiProvider', apiProviderSchema);
