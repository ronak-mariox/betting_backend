const { Router } = require('express');
const { body } = require('express-validator');
const kycController = require('../controllers/kyc.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { KYC_DOCUMENT_TYPES } = require('../constants/admin');

/** The player's own KYC, from the app's KYC Verification flow. */
const router = Router();
router.use(authenticate, authorize('player'));

router.get('/me', kycController.getMine);

const fileRule = (field) => [
  body(`${field}.name`).optional().isString().isLength({ max: 120 }),
  body(`${field}.data`).isString().withMessage(`${field} document is required`),
];

router.post(
  '/',
  [
    body('fullName').trim().isLength({ min: 2, max: 80 }).withMessage('Full name is required'),
    body('phone').trim().matches(/^[6-9]\d{9}$/).withMessage('Sahi 10 digit mobile number daalo'),
    body('dob').isISO8601().withMessage('Date of birth must be a valid date'),
    body('address').trim().isLength({ min: 3, max: 200 }).withMessage('Address is required'),
    body('city').trim().isLength({ min: 2, max: 60 }).withMessage('City is required'),
    body('state').trim().isLength({ min: 2, max: 60 }).withMessage('State is required'),
    body('country').optional().trim().isLength({ max: 60 }),
    body('postalCode').trim().matches(/^[A-Za-z0-9 -]{4,10}$/).withMessage('Postal code is invalid'),
    body('documentType').isIn(KYC_DOCUMENT_TYPES).withMessage('Choose a document type'),
    body('documentNumber').trim().isLength({ min: 4, max: 30 }).withMessage('Document number is required'),
    ...fileRule('front'),
    body('back').optional({ nullable: true }),
    body('back.data').optional().isString(),
  ],
  validate,
  kycController.submit,
);

module.exports = router;
