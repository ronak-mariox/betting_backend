const { Router } = require('express');
const { body, param } = require('express-validator');
const permissionController = require('../controllers/permission.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLE_KEYS } = require('../constants/permissions');

const router = Router();
router.use(authenticate);

router.get('/', authorize('super-admin'), permissionController.getFullMatrix);

router.get(
  '/:roleKey',
  [param('roleKey').isIn(ROLE_KEYS)],
  validate,
  permissionController.getOne,
);

router.put(
  '/:roleKey/:groupKey/:permissionKey',
  authorize('super-admin'),
  [
    param('roleKey').isIn(ROLE_KEYS),
    body('grant').isString().matches(/^[EVX]{0,3}$/).withMessage('grant must be made of only E, V, X'),
  ],
  validate,
  permissionController.updateGrant,
);

module.exports = router;
