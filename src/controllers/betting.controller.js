const asyncHandler = require('../utils/asyncHandler');
const bettingService = require('../services/betting.service');

const listMatches = asyncHandler(async (req, res) => {
  const matches = await bettingService.listMatches(req.query);
  res.json({ matches });
});

const listProviders = asyncHandler(async (_req, res) => {
  const providers = await bettingService.listProviders();
  res.json({ providers });
});

const syncAllProviders = asyncHandler(async (_req, res) => {
  const providers = await bettingService.syncAllProviders();
  res.json({ providers });
});

module.exports = { listMatches, listProviders, syncAllProviders };
