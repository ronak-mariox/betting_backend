const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/report.service');
const { scopeFor } = require('../services/scope.service');
const { toCsv } = require('../utils/csv');

const preview = asyncHandler(async (req, res) => {
  const rows = await reportService.buildReport(req.params.kind, { ...req.query, scope: await scopeFor(req.user) });
  res.json({ kind: req.params.kind, rows, total: rows.length });
});

const exportCsv = asyncHandler(async (req, res) => {
  const rows = await reportService.buildReport(req.params.kind, { ...req.query, scope: await scopeFor(req.user) });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const csv = toCsv(rows, columns);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.kind}-report.csv"`);
  res.send(csv);
});

module.exports = { preview, exportCsv };
