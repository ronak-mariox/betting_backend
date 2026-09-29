const Event = require('../models/Event');
const Market = require('../models/Market');
const ApiProvider = require('../models/ApiProvider');

const TAB_STATUS = {
  live: 'Live',
  upcoming: 'Upcoming',
  completed: 'Completed',
};

const listMatches = async ({ tab }) => {
  const filter = {};
  if (tab && TAB_STATUS[tab]) filter.status = TAB_STATUS[tab];

  const events = await Event.find(filter).sort({ startTime: 1 }).lean();
  const eventIds = events.map((e) => e._id);
  const markets = await Market.find({ event: { $in: eventIds } }).lean();

  const marketsByEvent = markets.reduce((acc, market) => {
    const key = String(market.event);
    if (!acc[key]) acc[key] = [];
    acc[key].push(market);
    return acc;
  }, {});

  return events.map((event) => ({ ...event, markets: marketsByEvent[String(event._id)] || [] }));
};

const listProviders = async () => ApiProvider.find().sort({ name: 1 });

const syncAllProviders = async () => {
  const providers = await ApiProvider.find();
  await Promise.all(
    providers.map((provider) =>
      ApiProvider.updateOne(
        { _id: provider._id },
        { $set: { status: 'Connected', healthy: true, lastSyncAt: new Date() } },
      ),
    ),
  );
  return listProviders();
};

module.exports = { listMatches, listProviders, syncAllProviders };
