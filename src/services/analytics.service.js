const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Commission = require('../models/Commission');

const MONTHS_BACK = 6;

const monthsRange = () => {
  const months = [];
  const now = new Date();
  for (let i = MONTHS_BACK - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
};

const monthStart = (label) => {
  const [year, month] = label.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

const monthEnd = (label) => {
  const [year, month] = label.split('-').map(Number);
  return new Date(year, month, 1);
};

const seriesFor = async (dimension) => {
  const months = monthsRange();

  if (dimension === 'revenue') {
    return Promise.all(
      months.map(async (month) => {
        const agg = await Transaction.aggregate([
          { $match: { createdAt: { $gte: monthStart(month), $lt: monthEnd(month) }, type: { $in: ['Bet Win', 'Bet Loss'] } } },
          { $group: { _id: null, total: { $sum: { $multiply: ['$amount', -1] } } } },
        ]);
        return { month, value: agg[0]?.total || 0 };
      }),
    );
  }

  if (dimension === 'users') {
    return Promise.all(
      months.map(async (month) => {
        const count = await User.countDocuments({ createdAt: { $lt: monthEnd(month) } });
        return { month, value: count };
      }),
    );
  }

  if (dimension === 'sports') {
    const agg = await Bet.aggregate([
      { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $group: { _id: '$event.sport', value: { $sum: '$amount' } } },
      { $project: { _id: 0, sport: '$_id', value: 1 } },
      { $sort: { value: -1 } },
    ]);
    return agg;
  }

  if (dimension === 'commission') {
    return Promise.all(
      months.map(async (month) => {
        const agg = await Commission.aggregate([
          { $match: { period: month } },
          { $group: { _id: null, total: { $sum: '$commission' } } },
        ]);
        return { month, value: agg[0]?.total || 0 };
      }),
    );
  }

  return [];
};

const getHighlights = async () => {
  const [totalUsers, totalBets, turnoverAgg, totalCommissionAgg] = await Promise.all([
    User.countDocuments(),
    Bet.countDocuments(),
    Bet.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    Commission.aggregate([{ $group: { _id: null, total: { $sum: '$commission' } } }]),
  ]);

  return {
    totalUsers,
    totalBets,
    totalTurnover: turnoverAgg[0]?.total || 0,
    totalCommission: totalCommissionAgg[0]?.total || 0,
  };
};

/** Monthly deposits vs withdrawals from the ledger; `value` is the net inflow. */
const walletFlowSeries = async () => {
  const months = monthsRange();
  const agg = await Transaction.aggregate([
    {
      $match: {
        type: { $in: ['Deposit', 'Withdrawal'] },
        status: 'Completed',
        createdAt: { $gte: monthStart(months[0]), $lt: monthEnd(months[months.length - 1]) },
      },
    },
    {
      $group: {
        _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, type: '$type' },
        total: { $sum: { $abs: '$amount' } },
      },
    },
  ]);

  return months.map((month) => {
    const sum = (type) => agg.find((row) => row._id.month === month && row._id.type === type)?.total || 0;
    const deposits = sum('Deposit');
    const withdrawals = sum('Withdrawal');
    return { month, deposits, withdrawals, value: deposits - withdrawals };
  });
};

module.exports = { seriesFor, getHighlights, walletFlowSeries };
