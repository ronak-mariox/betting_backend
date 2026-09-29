const { Router } = require('express');
const { body, param, query } = require('express-validator');
const cmsController = require('../controllers/cms.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { CMS_KINDS, CMS_STATUSES } = require('../constants/admin');

const router = Router();
router.use(authenticate, authorize('super-admin'));

router.get('/marquee', cmsController.getMarquee);
router.patch('/marquee', [body('marqueeText').isString()], validate, cmsController.updateMarquee);

router.get('/', [query('kind').optional().isIn(CMS_KINDS)], validate, cmsController.list);

router.post(
  '/',
  [
    body('kind').isIn(CMS_KINDS),
    body('title').trim().notEmpty(),
    body('body').optional().isString(),
    body('status').optional().isIn(CMS_STATUSES),
    body('target').optional().isString(),
  ],
  validate,
  cmsController.create,
);

router.patch('/:id', [param('id').isMongoId()], validate, cmsController.update);
router.delete('/:id', [param('id').isMongoId()], validate, cmsController.remove);

module.exports = router;
