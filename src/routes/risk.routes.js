const { Router } = require('express');
const { param } = require('express-validator');
const riskController = require('../controllers/risk.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.use(authenticate, authorize('super-admin'));

router.get('/stats', riskController.stats);
router.get('/exposure', riskController.exposure);
router.get('/panels', riskController.panels);
router.patch(
  '/exposure/:marketId/suspend',
  [param('marketId').isMongoId()],
  validate,
  riskController.suspendExposure,
);

module.exports = router;
