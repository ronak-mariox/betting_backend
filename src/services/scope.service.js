const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const permissionService = require('./permission.service');
const { loadTree, descendants } = require('./tree.service');

/**
 * Which accounts an actor's finance views cover: null (= everything) for
 * super-admin, otherwise the actor plus their whole downline. Wallet,
 * transactions, commission and reports all filter through this, so a
 * franchise / super-agent / agent only ever sees their own network.
 */
async function scopeFor(actor) {
  if (actor.role === 'super-admin') return null;
  const tree = await loadTree();
  const ids = [String(actor._id), ...descendants(tree, actor._id)];
  return ids.map((id) => new mongoose.Types.ObjectId(id));
}

/** Adds `{ [field]: { $in: scope } }` to a Mongo filter when the actor is scoped. */
function applyScope(filter, scope, field = 'user') {
  if (scope) filter[field] = { $in: scope };
  return filter;
}

/** Throws 403 unless the actor holds `groupKey.permissionKey` at `action` (super-admin always does). */
async function requireGrant(actor, groupKey, permissionKey, action, message) {
  const allowed = await permissionService.hasPermission(actor.role, groupKey, permissionKey, action);
  if (!allowed) throw ApiError.forbidden(message || 'You do not have permission for this action');
}

/** Express middleware form of requireGrant. */
const grant = (groupKey, permissionKey, action, message) => async (req, _res, next) => {
  try {
    await requireGrant(req.user, groupKey, permissionKey, action, message);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { scopeFor, applyScope, requireGrant, grant };
