const { Router } = require('express');
const { param, query } = require('express-validator');
const commissionController = require('../controllers/commission.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { COMMISSION_LEVELS, COMMISSION_STATUSES } = require('../constants/admin');

const router = Router();
router.use(authenticate, authorize('super-admin', 'franchise', 'super-agent', 'agent'));
const adminOnly = authorize('super-admin');

router.get(
  '/',
  [query('level').optional().isIn(COMMISSION_LEVELS), query('status').optional().isIn(COMMISSION_STATUSES)],
  validate,
  commissionController.list,
);

router.post('/recompute', adminOnly, commissionController.recompute);
router.post('/:id/settle', adminOnly, [param('id').isMongoId()], validate, commissionController.settle);

module.exports = router;
