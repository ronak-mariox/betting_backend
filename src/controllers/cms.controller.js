const asyncHandler = require('../utils/asyncHandler');
const cmsService = require('../services/cms.service');

const list = asyncHandler(async (req, res) => {
  res.json({ items: await cmsService.listContent(req.query) });
});

const create = asyncHandler(async (req, res) => {
  const content = await cmsService.createContent({ actor: req.user, ...req.body });
  res.status(201).json({ content });
});

const update = asyncHandler(async (req, res) => {
  const content = await cmsService.updateContent(req.params.id, req.body);
  res.json({ content });
});

const remove = asyncHandler(async (req, res) => {
  await cmsService.deleteContent(req.params.id);
  res.json({ success: true });
});

const getMarquee = asyncHandler(async (_req, res) => {
  res.json({ marqueeText: await cmsService.getMarquee() });
});

const updateMarquee = asyncHandler(async (req, res) => {
  res.json({ marqueeText: await cmsService.setMarquee(req.body.marqueeText) });
});

module.exports = { list, create, update, remove, getMarquee, updateMarquee };
