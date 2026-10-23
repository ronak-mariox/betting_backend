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

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const BRAND_COLORS = ['primaryColor', 'accentColor', 'backgroundColor', 'successColor'];
/** Brightness a primary / accent colour needs to read on the dark panel (#2196f3 is ~0.5). */
const MIN_ACCENT_LUMINANCE = 0.2;

/** "#abc" -> "#aabbcc", lower-case. */
const fullHex = (value) => {
  const hex = value.trim().toLowerCase();
  return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
};

/** Relative luminance 0 (black) … 1 (white). */
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * The panel applies the brand section live (colours on its theme, name /
 * tagline / logo in the shell), so it must be valid before it's stored.
 */
function cleanBrand(updates) {
  const out = {};
  const text = (key, max) => {
    if (updates[key] === undefined) return;
    const value = String(updates[key] ?? '').trim();
    if (value.length > max) throw ApiError.badRequest(`${key} can be at most ${max} characters`);
    out[key] = value;
  };
  text('brandName', 40);
  text('tagline', 80);
  if (updates.logoUrl !== undefined) {
    const url = String(updates.logoUrl ?? '').trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) throw ApiError.badRequest('Logo URL must start with http:// or https://');
    out.logoUrl = url;
  }
  for (const key of BRAND_COLORS) {
    if (updates[key] === undefined) continue; // eslint-disable-line no-continue
    const value = String(updates[key] ?? '').trim();
    if (!value) {
      out[key] = ''; // empty = the panel's default
      continue; // eslint-disable-line no-continue
    }
    if (!HEX.test(value)) throw ApiError.badRequest(`${key} must be a hex colour like #2196f3`);
    out[key] = fullHex(value);
  }
  // The panel is dark-only (white text): a light background would make it unreadable.
  if (out.backgroundColor && luminance(out.backgroundColor) > 0.25) {
    throw ApiError.badRequest('Background must be a dark colour — the panel uses white text');
  }
  // Primary / accent colour links, tabs and selected chips on that dark background: they must stand out from it.
  for (const key of ['primaryColor', 'accentColor']) {
    if (out[key] && luminance(out[key]) < MIN_ACCENT_LUMINANCE) {
      throw ApiError.badRequest(`${key} is too dark to read on the dark panel — pick a brighter colour`);
    }
  }
  return out;
}

/** What every visitor (login page included) sees: name, tagline, logo and valid colours. */
const getBranding = async () => {
  const settings = await Settings.findById('main').lean();
  const brand = settings?.brand || {};
  const color = (v) => (typeof v === 'string' && HEX.test(v) ? fullHex(v) : '');
  return {
    brandName: brand.brandName || settings?.general?.platformName || '',
    tagline: brand.tagline || '',
    logoUrl: typeof brand.logoUrl === 'string' && /^https?:\/\//i.test(brand.logoUrl) ? brand.logoUrl : '',
    // Colours saved before validation existed are only used when readable.
    primaryColor: color(brand.primaryColor) && luminance(color(brand.primaryColor)) >= MIN_ACCENT_LUMINANCE ? color(brand.primaryColor) : '',
    accentColor: color(brand.accentColor) && luminance(color(brand.accentColor)) >= MIN_ACCENT_LUMINANCE ? color(brand.accentColor) : '',
    backgroundColor: color(brand.backgroundColor) && luminance(fullHex(brand.backgroundColor)) <= 0.25 ? fullHex(brand.backgroundColor) : '',
    successColor: color(brand.successColor),
  };
};

const updateSection = async (section, updates) => {
  if (!SECTIONS.includes(section)) throw ApiError.badRequest(`Unknown settings section: ${section}`);
  if (section === 'brand') {
    // Saving one card keeps what the other card stored.
    const current = (await Settings.findById('main').lean())?.brand || {};
    // eslint-disable-next-line no-param-reassign
    updates = { ...current, ...cleanBrand(updates) };
  }
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

module.exports = { getSettings, updateSection, addApiKey, updateApiKey, deleteApiKey, SECTIONS, getBranding };
