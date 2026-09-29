const asyncHandler = require('../utils/asyncHandler');
const analyticsService = require('../services/analytics.service');

const series = asyncHandler(async (req, res) => {
  const data = await analyticsService.seriesFor(req.query.dimension);
  res.json({ dimension: req.query.dimension, series: data });
});

const highlights = asyncHandler(async (_req, res) => {
  res.json({ highlights: await analyticsService.getHighlights() });
});

module.exports = { series, highlights };
