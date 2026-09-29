const { Router } = require('express');
const notificationController = require('../controllers/notification.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.use(authenticate, authorize('super-admin'));

router.get('/', notificationController.list);
router.patch('/read-all', notificationController.readAll);
router.delete('/', notificationController.clear);

module.exports = router;
