const Event = require('../models/Event');
const Market = require('../models/Market');
const Bet = require('../models/Bet');
const ApiError = require('../utils/ApiError');
const notificationService = require('./notification.service');

const listEvents = async ({ status, sport }) => {
  const filter = {};
  if (status) filter.status = status;
  if (sport) filter.sport = sport;
  return Event.find(filter).sort({ startTime: 1 });
};

const getEvent = async (id) => {
  const event = await Event.findById(id);
  if (!event) throw ApiError.notFound('Event not found');
  const markets = await Market.find({ event: event._id }).sort({ createdAt: 1 });
  const recentBets = await Bet.find({ event: event._id })
    .populate('user', 'name username')
    .sort({ createdAt: -1 })
    .limit(20);
  return { event, markets, recentBets };
};

const createEvent = async ({ sport, league, name, emoji, startTime }) => {
  return Event.create({ sport, league, name, emoji, startTime });
};

const updateEventStatus = async ({ id, status }) => {
  const before = await Event.findById(id).select('status');
  const event = await Event.findByIdAndUpdate(id, { status }, { new: true });
  if (!event) throw ApiError.notFound('Event not found');
  if (status === 'Live' && before?.status !== 'Live') await notificationService.notifyMatchLive(event);
  if (status === 'Suspended' || status === 'Completed' || status === 'Settled') {
    await Market.updateMany({ event: event._id, status: 'Active' }, { $set: { status: 'Suspended' } });
  }
  return event;
};

/** The live score line players see on the match ("142/3 (16.2 Ov)", "2 - 1"); '' clears it. */
const updateEventScore = async ({ id, score }) => {
  const event = await Event.findByIdAndUpdate(id, { score: String(score || '').trim() }, { new: true });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
};

module.exports = { listEvents, getEvent, createEvent, updateEventStatus, updateEventScore };
