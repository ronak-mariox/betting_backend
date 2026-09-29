const { body } = require('express-validator');

/**
 * An Indian mobile number in any common spelling ("9876543210",
 * "+91 98765 43210", "098765-43210") → "+91 98765 43210", the one format
 * stored and shown everywhere. Returns null if it isn't a mobile number.
 */
function normalizeMobile(value) {
  const raw = String(value ?? '').trim();
  if (!/^[\d+\-\s()]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  let local = digits;
  if (digits.length === 12 && digits.startsWith('91')) local = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) local = digits.slice(1);
  return /^[6-9]\d{9}$/.test(local) ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : null;
}

/** express-validator rule: optional phone that must be a real mobile, saved normalised. */
const phoneRule = () =>
  body('phone')
    .optional({ checkFalsy: true })
    .custom((value) => normalizeMobile(value) !== null)
    .withMessage('Enter a valid 10-digit mobile number')
    .customSanitizer(normalizeMobile);

module.exports = { normalizeMobile, phoneRule };
