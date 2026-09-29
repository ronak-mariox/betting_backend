const { Router } = require('express');
const { query } = require('express-validator');
const bettingController = require('../controllers/betting.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.use(authenticate, authorize('super-admin'));

router.get(
  '/matches',
  [query('tab').optional().isIn(['live', 'upcoming', 'completed'])],
  validate,
  bettingController.listMatches,
);
router.get('/providers', bettingController.listProviders);
router.post('/providers/sync-all', bettingController.syncAllProviders);

module.exports = router;
