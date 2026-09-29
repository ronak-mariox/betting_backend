const { Router } = require('express');
const { param, query } = require('express-validator');
const reportController = require('../controllers/report.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { grant } = require('../services/scope.service');
const { REPORT_KINDS } = require('../services/report.service');

const router = Router();
// Staff get their own network's reports (scoped in the controller).
router.use(
  authenticate,
  authorize('super-admin', 'franchise', 'super-agent', 'agent'),
  grant('reportsAnalytics', 'reports', 'V', 'You do not have permission to view reports'),
);

const kindValidator = [
  param('kind').isIn(REPORT_KINDS),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('groupBy').optional().isIn(['Daily', 'Weekly', 'Monthly', 'Quarterly']),
];

router.get('/:kind/preview', kindValidator, validate, reportController.preview);
router.get(
  '/:kind/export',
  grant('reportsAnalytics', 'exportData', 'X', 'You do not have permission to export reports'),
  kindValidator,
  validate,
  reportController.exportCsv,
);

module.exports = router;
