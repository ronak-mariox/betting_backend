const asyncHandler = require('../utils/asyncHandler');
const walletService = require('../services/wallet.service');
const playerBetService = require('../services/playerBet.service');
const notificationService = require('../services/notification.service');

const wallet = asyncHandler(async (req, res) => {
  res.json(await walletService.getPlayerWallet(req.user));
});

const walletRequest = asyncHandler(async (req, res) => {
  const request = await walletService.createPlayerRequest(req.user, req.body);
  res.status(201).json({ request, wallet: await walletService.getPlayerWallet(req.user) });
});

const matches = asyncHandler(async (_req, res) => {
  res.json({ matches: await playerBetService.listMatches() });
});

const match = asyncHandler(async (req, res) => {
  res.json({ match: await playerBetService.getMatch(req.params.id) });
});

const bets = asyncHandler(async (req, res) => {
  res.json({ bets: await playerBetService.listBets(req.user) });
});

const placeBet = asyncHandler(async (req, res) => {
  const bet = await playerBetService.placeBet(req.user, req.body);
  res.status(201).json({ bet, wallet: await walletService.getPlayerWallet(req.user) });
});

const cashOut = asyncHandler(async (req, res) => {
  const result = await playerBetService.cashOut(req.user, req.params.id);
  res.json({ ...result, wallet: await walletService.getPlayerWallet(req.user) });
});

const notifications = asyncHandler(async (req, res) => {
  res.json(await notificationService.listForPlayer(req.user, { limit: req.query.limit }));
});

const readNotification = asyncHandler(async (req, res) => {
  res.json(await notificationService.markReadForPlayer(req.user, req.params.id));
});

const readAllNotifications = asyncHandler(async (req, res) => {
  res.json(await notificationService.markAllReadForPlayer(req.user));
});

module.exports = {
  wallet,
  walletRequest,
  matches,
  match,
  bets,
  placeBet,
  cashOut,
  notifications,
  readNotification,
  readAllNotifications,
};
