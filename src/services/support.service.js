const Ticket = require('../models/Ticket');
const ApiError = require('../utils/ApiError');
const escapeRegex = require('../utils/escapeRegex');
const notificationService = require('./notification.service');

const listTickets = async ({ status, priority, q, raisedBy }) => {
  const filter = {};
  if (raisedBy) filter.raisedBy = raisedBy;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (q) filter.subject = new RegExp(escapeRegex(q), 'i');
  return Ticket.find(filter).populate('raisedBy', 'name username role').sort({ createdAt: -1 });
};

/** `raisedBy` limits the lookup to that account's own tickets (anything else reads as not found). */
const getTicket = async (id, { raisedBy } = {}) => {
  const ticket = await Ticket.findOne({ _id: id, ...(raisedBy ? { raisedBy } : {}) })
    .populate('raisedBy', 'name username role')
    .populate('messages.author', 'name username');
  if (!ticket) throw ApiError.notFound('Ticket not found');
  return ticket;
};

const createTicket = async ({ subject, category, raisedBy, role, priority, body }) => {
  const ticket = await Ticket.create({
    subject,
    category,
    raisedBy,
    role,
    priority,
    messages: body ? [{ author: raisedBy, fromSupport: false, body }] : [],
  });

  await notificationService.notify({
    title: 'New support ticket',
    body: subject,
    category: 'general',
    emoji: '🎫',
  });

  return ticket;
};

const updateStatus = async (id, status) => {
  const ticket = await Ticket.findByIdAndUpdate(id, { status }, { new: true });
  if (!ticket) throw ApiError.notFound('Ticket not found');
  return ticket;
};

const addMessage = async ({ id, author, fromSupport, body }) => {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  if (ticket.status === 'Closed') throw ApiError.conflict('This ticket is closed — raise a new one');
  ticket.messages.push({ author, fromSupport, body });
  if (fromSupport && ticket.status === 'Open') ticket.status = 'In Progress';
  // The person who raised it wrote back: a resolved ticket is open again.
  if (!fromSupport && ticket.status === 'Resolved') ticket.status = 'In Progress';
  await ticket.save();
  return ticket;
};

module.exports = { listTickets, getTicket, createTicket, updateStatus, addMessage };
