const { Router } = require('express');
const { body, param, query } = require('express-validator');
const playerController = require('../controllers/player.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

/** The player's own wallet, match feed and bets, for the bettingApp. */
const router = Router();
router.use(authenticate, authorize('player'));

router.get('/wallet', playerController.wallet);
router.post(
  '/wallet/requests',
  [
    body('kind').isIn(['deposit', 'withdrawal']),
    body('amount').isFloat({ gt: 0 }),
    body('method').optional().isString().isLength({ max: 40 }),
    // A withdrawal's reference says where to pay; a deposit's is the UTR the
    // agent matches the payment by, so a deposit can't be filed without one.
    body('reference')
      .if(body('kind').equals('withdrawal'))
      .optional()
      .isString()
      .isLength({ max: 80 }),
    body('reference')
      .if(body('kind').equals('deposit'))
      .trim()
      .notEmpty()
      .withMessage('Transaction ID daalna zaroori hai')
      .bail()
      .matches(/^[a-zA-Z0-9]{6,40}$/)
      .withMessage('Transaction ID 6 se 40 letters ya digits ka hona chahiye')
      .toUpperCase(),
    // …and the screenshot of the payment, which the reviewer checks against it.
    body('proof.data')
      .if(body('kind').equals('deposit'))
      .isString()
      .withMessage('Payment ka screenshot lagana zaroori hai')
      .bail()
      .matches(/^data:image\/(png|jpe?g|webp);base64,/)
      .withMessage('Payment screenshot JPG, PNG ya WebP photo honi chahiye'),
    body('proof.name').optional().isString().isLength({ max: 120 }),
  ],
  validate,
  playerController.walletRequest,
);

router.get('/matches', playerController.matches);
router.get('/matches/:id', [param('id').isMongoId()], validate, playerController.match);

router.get('/bets', playerController.bets);
router.post(
  '/bets',
  [body('marketId').isMongoId(), body('selection').isString().trim().notEmpty(), body('stake').isFloat({ gt: 0 })],
  validate,
  playerController.placeBet,
);
router.post('/bets/:id/cashout', [param('id').isMongoId()], validate, playerController.cashOut);

// The player's own notification feed (deposits, bets, KYC, logins, promotions).
router.get('/notifications', [query('limit').optional().isInt({ min: 1, max: 100 })], validate, playerController.notifications);
router.patch('/notifications/read-all', playerController.readAllNotifications);
router.patch('/notifications/:id/read', [param('id').isMongoId()], validate, playerController.readNotification);

module.exports = router;
