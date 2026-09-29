/**
 * Wipes the database back to the demo logins (mithu8178, franchise01,
 * superagent01, agent01) and reseeds the demo book (see seed.service.js).
 *
 *   npm run reset-demo
 *
 * Deletes every player and all bets, wallet, KYC, support, CMS, partner,
 * notification and audit data. Refuses to run in production.
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const { runBootstrap } = require('../src/services/bootstrap.service');
const { withDemoSeedLock } = require('../src/services/seed.service');

const KEEP_USERS = ['franchise01', 'superagent01', 'agent01'];
const WIPE = [
  'events', 'markets', 'bets', 'walletrequests', 'transactions', 'payments', 'commissions',
  'partners', 'partnersettlements', 'cmscontents', 'notifications', 'tickets', 'kycsubmissions',
  'flaggedusers', 'suspiciouspatterns', 'apiproviders', 'auditlogs',
];

(async () => {
  if (env.nodeEnv === 'production') {
    console.error('reset-demo refuses to run with NODE_ENV=production');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // Held for the whole wipe + reseed so a dev-server restart can't seed in between.
  await withDemoSeedLock(async () => {
    const keep = await User.find({ $or: [{ role: 'super-admin' }, { username: { $in: KEEP_USERS } }] }, '_id').lean();
    const keepIds = keep.map((u) => u._id);
    const removedUsers = await User.deleteMany({ _id: { $nin: keepIds } });
    await db.collection('refreshtokens').deleteMany({ user: { $nin: keepIds } });
    await User.updateMany({ _id: { $in: keepIds } }, { $set: { walletBalance: 0, kyc: 'Not Submitted' } });

    const wiped = {};
    for (const name of WIPE) {
      // eslint-disable-next-line no-await-in-loop
      wiped[name] = (await db.collection(name).deleteMany({})).deletedCount;
    }
    console.log('removed users:', removedUsers.deletedCount, 'wiped:', wiped);

    await runBootstrap();
  }, { wait: true });

  const players = await User.countDocuments({ role: 'player' });
  if (players !== 3) throw new Error(`Expected 3 demo players after reseed, found ${players}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
