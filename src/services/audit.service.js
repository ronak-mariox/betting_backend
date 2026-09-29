const AuditLog = require('../models/AuditLog');
const { cleanIp } = require('../utils/ip');

/** Fire-and-forget audit write — never let logging break the request it's describing. */
const record = async ({ actor, action, target, status = 'success', req, metadata }) => {
  try {
    await AuditLog.create({
      actor: actor?._id || actor || null,
      actorUsername: actor?.username || '',
      action,
      target: target?._id || target || null,
      status,
      ip: cleanIp(req?.ip),
      userAgent: req?.headers?.['user-agent'] || '',
      metadata,
    });
  } catch (err) {
    console.error('audit log write failed:', err.message); // eslint-disable-line no-console
  }
};

module.exports = { record };
