const { Router } = require('express');
const { query } = require('express-validator');
const transactionController = require('../controllers/transaction.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { grant } = require('../services/scope.service');

const router = Router();
// Staff see their own network's ledger (scoped in the controller).
router.use(
  authenticate,
  authorize('super-admin', 'franchise', 'super-agent', 'agent'),
  grant('finance', 'walletBalance', 'V', 'You do not have permission to view transactions'),
);

router.get(
  '/',
  [
    query('tab').optional().isString(),
    query('q').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  transactionController.list,
);

module.exports = router;
