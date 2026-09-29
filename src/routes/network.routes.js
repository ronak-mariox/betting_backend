const { Router } = require('express');
const { param, query } = require('express-validator');
const networkController = require('../controllers/network.controller');
const { KYC_STATUSES } = require('../constants/admin');
const validate = require('../middleware/validate');
const { authenticate, authorize, requireOwnSubtree } = require('../middleware/auth');

/**
 * Downline directory for the Users / Franchise / Super Agent / Agent pages.
 * Open to every staff role — results are always limited to the caller's own
 * downline (everyone, for super-admin).
 */
const router = Router();
router.use(authenticate, authorize('super-admin', 'franchise', 'super-agent', 'agent'));

/** The signed-in account's own dashboard (the Agent dashboard screen). */
router.get('/dashboard', networkController.myDashboard);

/** The signed-in account's Profile page data (stats, activity, logins, sessions, wallet). */
router.get('/me/profile', networkController.myProfile);

router.get(
  '/accounts',
  [
    query('role').optional().isIn(['franchise', 'super-agent', 'agent', 'player']),
    query('status').optional().isIn(['active', 'suspended']),
    query('kyc').optional().isIn(KYC_STATUSES),
    query('q').optional().isString().isLength({ max: 100 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  networkController.list,
);

router.get('/accounts/:id', [param('id').isMongoId()], validate, requireOwnSubtree('id'), networkController.getOne);

module.exports = router;
