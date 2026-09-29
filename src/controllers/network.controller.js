const asyncHandler = require('../utils/asyncHandler');
const networkService = require('../services/network.service');
const myDashboardService = require('../services/myDashboard.service');
const myProfileService = require('../services/myProfile.service');

const list = asyncHandler(async (req, res) => {
  res.json(await networkService.listAccounts(req.user, req.query));
});

const getOne = asyncHandler(async (req, res) => {
  res.json(await networkService.getAccountDetail(req.user, req.params.id));
});

const myDashboard = asyncHandler(async (req, res) => {
  res.json(await myDashboardService.getMyDashboard(req.user));
});

const myProfile = asyncHandler(async (req, res) => {
  res.json(await myProfileService.getMyProfile(req.user, req.headers['user-agent'] || ''));
});

module.exports = { list, getOne, myDashboard, myProfile };
