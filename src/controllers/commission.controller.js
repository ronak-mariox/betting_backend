const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const commissionService = require('../services/commission.service');
const permissionService = require('../services/permission.service');
const { scopeFor } = require('../services/scope.service');

/**
 * Everyone sees their own commission; the downline's rows need the
 * "Commission" view grant (super-admin sees all).
 */
async function commissionScope(actor) {
  const scope = await scopeFor(actor);
  if (!scope) return null;
  const canSeeDownline = await permissionService.hasPermission(actor.role, 'finance', 'commission', 'V');
  return canSeeDownline ? scope : [new mongoose.Types.ObjectId(String(actor._id))];
}

const list = asyncHandler(async (req, res) => {
  // Unsettled rows follow the bets placed so far this month, so the page
  // never shows a figure older than the dashboard's.
  await commissionService.recompute();
  const items = await commissionService.listCommission({ ...req.query, scope: await commissionScope(req.user) });
  res.json({ items });
});

const recompute = asyncHandler(async (_req, res) => {
  const items = await commissionService.recompute();
  res.json({ items });
});

const settle = asyncHandler(async (req, res) => {
  const row = await commissionService.settle({ id: req.params.id, actor: req.user });
  res.json({ commission: row });
});

module.exports = { list, recompute, settle };
