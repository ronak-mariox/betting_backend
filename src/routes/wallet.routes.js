const { Router } = require('express');
const { body, param, query } = require('express-validator');
const walletController = require('../controllers/wallet.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { grant } = require('../services/scope.service');
const { WALLET_REQUEST_KINDS, WALLET_REQUEST_STATUSES } = require('../constants/admin');

/**
 * Staff roles see their own network's wallet (scoped in the controller) when
 * the permission matrix grants "Wallet Balance"; approving deposits and
 * withdrawals needs the "Deposit" / "Withdrawal" grant. Manual entries,
 * partner payments and disbursements stay super-admin only.
 */
const router = Router();
const adminOnly = authorize('super-admin');
router.use(
  authenticate,
  authorize('super-admin', 'franchise', 'super-agent', 'agent'),
  grant('finance', 'walletBalance', 'V', 'You do not have permission to view the wallet'),
);

router.get('/stats', walletController.stats);

router.get(
  '/requests',
  [
    query('kind').optional().isIn(WALLET_REQUEST_KINDS),
    query('status').optional().isIn(WALLET_REQUEST_STATUSES),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  walletController.listRequests,
);

router.get('/requests/:id/proof', [param('id').isMongoId()], validate, walletController.requestProof);

router.post('/requests/:id/approve', [param('id').isMongoId()], validate, walletController.approveRequest);
router.post(
  '/requests/:id/reject',
  [param('id').isMongoId(), body('reason').optional().isString().trim().isLength({ max: 200 })],
  validate,
  walletController.rejectRequest,
);

router.post(
  '/transfer',
  grant('finance', 'fundTransfer', 'X', 'You do not have permission to transfer funds'),
  [
    body('toUserId').isMongoId().withMessage('Choose who to transfer to'),
    body('amount').isFloat({ gt: 0 }).withMessage('Enter an amount to transfer'),
    body('note').optional().isString().trim().isLength({ max: 120 }),
  ],
  validate,
  walletController.fundTransfer,
);

router.post(
  '/manual-entry',
  adminOnly,
  [
    body('userId').isMongoId(),
    body('action').isIn(['Credit', 'Debit', 'Adjustment', 'Transfer']),
    body('amount').isFloat({ gt: 0 }),
    body('toUserId').if(body('action').equals('Transfer')).isMongoId(),
    body('note').optional().isString(),
  ],
  validate,
  walletController.manualEntry,
);

router.get(
  '/payments',
  adminOnly,
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  walletController.listPayments,
);

router.post(
  '/payments',
  adminOnly,
  [
    body('recipientType').isIn(['User', 'Partner']),
    body('recipientId').isMongoId(),
    body('paymentType').optional().isString(),
    body('method').optional().isString(),
    body('amount').isFloat({ gt: 0 }),
    body('note').optional().isString(),
  ],
  validate,
  walletController.createPayment,
);

router.get(
  '/disbursements',
  adminOnly,
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  walletController.listDisbursements,
);

module.exports = router;
