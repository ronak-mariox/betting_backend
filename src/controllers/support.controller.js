const asyncHandler = require('../utils/asyncHandler');
const supportService = require('../services/support.service');

const list = asyncHandler(async (req, res) => {
  res.json({ tickets: await supportService.listTickets(req.query) });
});

const getOne = asyncHandler(async (req, res) => {
  res.json({ ticket: await supportService.getTicket(req.params.id) });
});

const create = asyncHandler(async (req, res) => {
  const { subject, category, raisedBy, role, priority, body } = req.body;
  const ticket = await supportService.createTicket({ subject, category, raisedBy, role, priority, body });
  res.status(201).json({ ticket });
});

const updateStatus = asyncHandler(async (req, res) => {
  const ticket = await supportService.updateStatus(req.params.id, req.body.status);
  res.json({ ticket });
});

const addMessage = asyncHandler(async (req, res) => {
  const ticket = await supportService.addMessage({
    id: req.params.id,
    author: req.user._id,
    fromSupport: true,
    body: req.body.body,
  });
  res.json({ ticket });
});

const listMine = asyncHandler(async (req, res) => {
  res.json({ tickets: await supportService.listTickets({ raisedBy: req.user._id }) });
});

const createMine = asyncHandler(async (req, res) => {
  const { subject, category, priority, body } = req.body;
  const ticket = await supportService.createTicket({
    subject,
    category: category || 'General',
    raisedBy: req.user._id,
    role: req.user.role,
    priority: priority || 'Medium',
    body,
  });
  res.status(201).json({ ticket });
});

const getMine = asyncHandler(async (req, res) => {
  res.json({ ticket: await supportService.getTicket(req.params.id, { raisedBy: req.user._id }) });
});

const replyMine = asyncHandler(async (req, res) => {
  await supportService.getTicket(req.params.id, { raisedBy: req.user._id });
  const ticket = await supportService.addMessage({ id: req.params.id, author: req.user._id, fromSupport: false, body: req.body.body });
  res.json({ ticket: await supportService.getTicket(ticket._id) });
});

module.exports = { list, getOne, create, updateStatus, addMessage, listMine, createMine, getMine, replyMine };
