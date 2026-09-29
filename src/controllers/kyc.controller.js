const asyncHandler = require('../utils/asyncHandler');
const kycService = require('../services/kyc.service');
const auditService = require('../services/audit.service');

const getMine = asyncHandler(async (req, res) => {
  res.json(await kycService.getMine(req.user));
});

const submit = asyncHandler(async (req, res) => {
  const result = await kycService.submit(req.user, req.body);
  await auditService.record({ actor: req.user, action: 'kyc_submitted', target: req.user, req, metadata: { documentType: req.body.documentType } });
  res.status(201).json(result);
});

module.exports = { getMine, submit };
