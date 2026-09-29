const asyncHandler = require('../utils/asyncHandler');
const eventService = require('../services/event.service');

const list = asyncHandler(async (req, res) => {
  const events = await eventService.listEvents(req.query);
  res.json({ events });
});

const getOne = asyncHandler(async (req, res) => {
  const result = await eventService.getEvent(req.params.id);
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.body);
  res.status(201).json({ event });
});

const updateStatus = asyncHandler(async (req, res) => {
  const event = await eventService.updateEventStatus({ id: req.params.id, status: req.body.status });
  res.json({ event });
});

const updateScore = asyncHandler(async (req, res) => {
  const event = await eventService.updateEventScore({ id: req.params.id, score: req.body.score });
  res.json({ event });
});

module.exports = { list, getOne, create, updateStatus, updateScore };
