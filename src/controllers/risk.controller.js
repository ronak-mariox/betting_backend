const asyncHandler = require('../utils/asyncHandler');
const riskService = require('../services/risk.service');

const stats = asyncHandler(async (_req, res) => {
  res.json({ stats: await riskService.getStats() });
});

const exposure = asyncHandler(async (_req, res) => {
  res.json({ markets: await riskService.getExposure() });
});

const panels = asyncHandler(async (_req, res) => {
  res.json(await riskService.getPanels());
});

const suspendExposure = asyncHandler(async (req, res) => {
  const market = await riskService.suspendExposure(req.params.marketId);
  res.json({ market });
});

module.exports = { stats, exposure, panels, suspendExposure };
