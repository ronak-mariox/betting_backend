const { Router } = require('express');
const { body, param, query } = require('express-validator');
const eventController = require('../controllers/event.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { EVENT_STATUSES } = require('../constants/admin');

const router = Router();
router.use(authenticate, authorize('super-admin'));

router.get('/', [query('status').optional().isIn(EVENT_STATUSES)], validate, eventController.list);

router.post(
  '/',
  [
    body('sport').trim().notEmpty(),
    body('name').trim().notEmpty(),
    body('league').optional().isString(),
    body('emoji').optional().isString(),
    body('startTime').isISO8601(),
  ],
  validate,
  eventController.create,
);

router.get('/:id', [param('id').isMongoId()], validate, eventController.getOne);

router.patch(
  '/:id/status',
  [param('id').isMongoId(), body('status').isIn(EVENT_STATUSES)],
  validate,
  eventController.updateStatus,
);

router.patch(
  '/:id/score',
  [param('id').isMongoId(), body('score').isString().trim().isLength({ max: 40 }).withMessage('Keep the score under 40 characters')],
  validate,
  eventController.updateScore,
);

module.exports = router;
