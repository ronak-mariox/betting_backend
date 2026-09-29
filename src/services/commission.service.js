const mongoose = require('mongoose');
const Commission = require('../models/Commission');
const Bet = require('../models/Bet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');
const { loadTree, descendants } = require('./tree.service');
const { applyScope } = require('./scope.service');

const LEVEL_BY_ROLE = { franchise: 'Franchise', 'super-agent': 'Super Agent', agent: 'Agent' };

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const listCommission = async ({ level, status, scope = null }) => {
  const filter = applyScope({}, scope, 'entity');
  if (level) filter.level = level;
  if (status) filter.status = status;
  return Commission.find(filter).populate('entity', 'name username role').sort({ period: -1, commission: -1 });
};

/**
 * Brings every franchise / super-agent / agent's open commission row up to
 * date: turnover is the stake its whole downline placed (staff don't bet
 * themselves) since the period began or since its last settlement, rate is
 * the account's own commissionRate or the Settings default for its role.
 * Settled rows are never touched.
 */
const recompute = async () => {
  const period = currentPeriod();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [settings, tree, entities, settledRows] = await Promise.all([
    Settings.findById('main'),
    loadTree(),
    User.find({ role: { $in: Object.keys(LEVEL_BY_ROLE) } }),
    Commission.find({ period, status: 'Settled' }, 'entity settledAt').lean(),
  ]);
  const defaultRates = settings?.commissionRates || {};
  const lastSettled = new Map();
  for (const row of settledRows) {
    const key = String(row.entity);
    if (!lastSettled.has(key) || row.settledAt > lastSettled.get(key)) lastSettled.set(key, row.settledAt);
  }

  const results = [];
  for (const entity of entities) {
    const from = lastSettled.get(String(entity._id)) || periodStart;
    const book = descendants(tree, entity._id).map((id) => new mongoose.Types.ObjectId(id));
    // eslint-disable-next-line no-await-in-loop
    const [agg] = await Bet.aggregate([
      { $match: { user: { $in: book }, createdAt: { $gte: from }, status: { $ne: 'Void' } } },
      { $group: { _id: null, turnover: { $sum: '$amount' } } },
    ]);
    const turnover = agg?.turnover || 0;
    const rate = entity.commissionRate ?? (Number(defaultRates[entity.role]) || 5);
    const commission = Math.round((turnover * rate) / 100);

    // Nothing earned since the last payout: no empty row to show.
    if (turnover === 0 && lastSettled.has(String(entity._id))) {
      // eslint-disable-next-line no-await-in-loop
      await Commission.deleteOne({ entity: entity._id, period, status: 'Pending' });
      continue; // eslint-disable-line no-continue
    }
    // eslint-disable-next-line no-await-in-loop
    const row = await Commission.findOneAndUpdate(
      { entity: entity._id, period, status: 'Pending' },
      { $set: { level: LEVEL_BY_ROLE[entity.role], turnover, rate, commission, from } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
    results.push(row);
  }

  return results;
};

const settle = async ({ id, actor }) => {
  const row = await Commission.findById(id);
  if (!row) throw ApiError.notFound('Commission row not found');
  if (row.status === 'Settled') throw ApiError.conflict('Commission already settled');

  // Claimed only while still pending, so a double click can't pay it twice.
  const claimed = await Commission.findOneAndUpdate(
    { _id: id, status: { $ne: 'Settled' } },
    { $set: { status: 'Settled', settledAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!claimed) throw ApiError.conflict('Commission already settled');
  row.status = claimed.status;
  row.settledAt = claimed.settledAt;

  // Settling pays the commission into the account's own wallet.
  await User.updateOne({ _id: row.entity }, { $inc: { walletBalance: row.commission } });

  await Transaction.create({
    user: row.entity,
    type: 'Commission',
    amount: row.commission,
    status: 'Completed',
    note: `Commission settled for ${row.period}`,
    createdBy: actor._id,
  });

  return row;
};

module.exports = { listCommission, recompute, settle };
