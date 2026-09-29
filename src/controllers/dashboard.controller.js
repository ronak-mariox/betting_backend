const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

const get = asyncHandler(async (_req, res) => {
  res.json(await dashboardService.getDashboard());
});

module.exports = { get };
