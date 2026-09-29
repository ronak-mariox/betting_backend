/**
 * Empties the database down to the four staff logins (mithu8178,
 * franchise01, superagent01, agent01) — no players, no demo book.
 *
 *   npm run wipe-data -- --yes
 *
 * Deletes every other account and all events, markets, bets, wallet
 * requests, transactions, commission, KYC, notifications, support, CMS,
 * partner and audit data, and signs every device out. Keeps the platform's
 * configuration (Settings, the permission matrix). Set SEED_DEMO_DATA=false
 * in .env, or the dev server puts the demo players back on its next start.
 * Refuses to run in production.
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const { withDemoSeedLock } = require('../src/services/seed.service');

const KEEP_USERS = ['franchise01', 'superagent01', 'agent01'];
/** Configuration, not data. */
const KEEP_COLLECTIONS = ['users', 'settings', 'permissions', 'locks'];

(async () => {
  if (env.nodeEnv === 'production') throw new Error('wipe-data refuses to run with NODE_ENV=production');
  if (!process.argv.includes('--yes')) throw new Error('This deletes all data. Run it as: npm run wipe-data -- --yes');

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // Held for the whole wipe so a dev-server restart can't seed in between.
  await withDemoSeedLock(
    async () => {
      const users = db.collection('users');
      const keep = await users.find({ $or: [{ role: 'super-admin' }, { username: { $in: KEEP_USERS } }] }, { projection: { username: 1 } }).toArray();
      const keepIds = keep.map((u) => u._id);
      const removed = await users.deleteMany({ _id: { $nin: keepIds } });
      await users.updateMany({ _id: { $in: keepIds } }, { $set: { walletBalance: 0, lastLoginAt: null } });

      const wiped = {};
      for (const { name } of await db.listCollections().toArray()) {
        if (KEEP_COLLECTIONS.includes(name)) continue; // eslint-disable-line no-continue
        // eslint-disable-next-line no-await-in-loop
        wiped[name] = (await db.collection(name).deleteMany({})).deletedCount;
      }
      console.log('kept logins:', keep.map((u) => u.username).join(', '));
      console.log('removed accounts:', removed.deletedCount);
      console.log('emptied:', wiped);
    },
    { wait: true },
  );
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
