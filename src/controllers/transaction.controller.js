const asyncHandler = require('../utils/asyncHandler');
const transactionService = require('../services/transaction.service');
const { scopeFor } = require('../services/scope.service');

const list = asyncHandler(async (req, res) => {
  const result = await transactionService.listTransactions({ ...req.query, scope: await scopeFor(req.user) });
  res.json(result);
});

module.exports = { list };
