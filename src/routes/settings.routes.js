const { Router } = require('express');
const { body, param } = require('express-validator');
const settingsController = require('../controllers/settings.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { SECTIONS } = require('../services/settings.service');

const router = Router();
router.use(authenticate, authorize('super-admin'));

router.get('/', settingsController.get);

router.patch('/api-keys/:keyId', [param('keyId').isMongoId()], validate, settingsController.updateApiKey);
router.delete('/api-keys/:keyId', [param('keyId').isMongoId()], validate, settingsController.deleteApiKey);
router.post(
  '/api-keys',
  [body('name').trim().notEmpty(), body('key').trim().notEmpty()],
  validate,
  settingsController.addApiKey,
);

router.patch('/:section', [param('section').isIn(SECTIONS)], validate, settingsController.updateSection);

module.exports = router;
