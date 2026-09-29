const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');

const SECTIONS = [
  'general',
  'walletRules',
  'bettingLimits',
  'exposureLimits',
  'commissionRates',
  'smtp',
  'sms',
  'brand',
];

const getSettings = async () => {
  return Settings.findByIdAndUpdate('main', { $setOnInsert: { _id: 'main' } }, { new: true, upsert: true });
};

const updateSection = async (section, updates) => {
  if (!SECTIONS.includes(section)) throw ApiError.badRequest(`Unknown settings section: ${section}`);
  return Settings.findByIdAndUpdate(
    'main',
    { $set: { [section]: updates } },
    { new: true, upsert: true, runValidators: true },
  );
};

const addApiKey = async ({ name, key }) => {
  return Settings.findByIdAndUpdate(
    'main',
    { $push: { apiKeys: { name, key, status: 'Active', latency: 0 } } },
    { new: true, upsert: true },
  );
};

const updateApiKey = async (keyId, updates) => {
  const settings = await Settings.findById('main');
  if (!settings) throw ApiError.notFound('Settings not found');
  const entry = settings.apiKeys.id(keyId);
  if (!entry) throw ApiError.notFound('API key not found');
  Object.assign(entry, updates);
  await settings.save();
  return settings;
};

const deleteApiKey = async (keyId) => {
  const settings = await Settings.findByIdAndUpdate(
    'main',
    { $pull: { apiKeys: { _id: new mongoose.Types.ObjectId(keyId) } } },
    { new: true },
  );
  if (!settings) throw ApiError.notFound('Settings not found');
  return settings;
};

module.exports = { getSettings, updateSection, addApiKey, updateApiKey, deleteApiKey, SECTIONS };
