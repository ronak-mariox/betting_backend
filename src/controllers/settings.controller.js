const asyncHandler = require('../utils/asyncHandler');
const settingsService = require('../services/settings.service');

const get = asyncHandler(async (_req, res) => {
  res.json({ settings: await settingsService.getSettings() });
});

const updateSection = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSection(req.params.section, req.body);
  res.json({ settings });
});

const addApiKey = asyncHandler(async (req, res) => {
  const settings = await settingsService.addApiKey(req.body);
  res.status(201).json({ settings });
});

const updateApiKey = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateApiKey(req.params.keyId, req.body);
  res.json({ settings });
});

const deleteApiKey = asyncHandler(async (req, res) => {
  const settings = await settingsService.deleteApiKey(req.params.keyId);
  res.json({ settings });
});

module.exports = { get, updateSection, addApiKey, updateApiKey, deleteApiKey };
