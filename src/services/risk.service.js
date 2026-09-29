const Market = require('../models/Market');
const FlaggedUser = require('../models/FlaggedUser');
const SuspiciousPattern = require('../models/SuspiciousPattern');
const WalletRequest = require('../models/WalletRequest');
const ApiError = require('../utils/ApiError');

const LARGE_PENDING_THRESHOLD = 50000;

const getStats = async () => {
  const [flaggedCount, patternCount, highExposureMarkets, largePendingRequests] = await Promise.all([
    FlaggedUser.countDocuments({ active: true }),
    SuspiciousPattern.countDocuments({ resolved: false }),
    Market.countDocuments({ status: 'Active', $expr: { $gte: ['$exposure', '$maxExposure'] } }),
    WalletRequest.countDocuments({ status: 'Pending', amount: { $gte: LARGE_PENDING_THRESHOLD } }),
  ]);

  return { flaggedCount, patternCount, highExposureMarkets, largePendingRequests };
};

const getExposure = async () => {
  return Market.find({ status: 'Active' })
    .populate('event', 'name sport')
    .sort({ exposure: -1 })
    .limit(50);
};

const getPanels = async () => {
  const [flaggedUsers, patterns, largePendingRequests] = await Promise.all([
    FlaggedUser.find({ active: true }).populate('user', 'name username').sort({ score: -1 }).limit(50),
    SuspiciousPattern.find({ resolved: false }).populate('relatedUsers', 'name username').sort({ detectedAt: -1 }).limit(50),
    WalletRequest.find({ status: 'Pending', amount: { $gte: LARGE_PENDING_THRESHOLD } })
      .populate('user', 'name username')
      .sort({ amount: -1 }),
  ]);

  return { flaggedUsers, patterns, largePendingRequests };
};

const suspendExposure = async (marketId) => {
  const market = await Market.findByIdAndUpdate(marketId, { status: 'Suspended' }, { new: true });
  if (!market) throw ApiError.notFound('Market not found');
  return market;
};

module.exports = { getStats, getExposure, getPanels, suspendExposure };
