const http = require('http');
const app = require('./src/app');
const realtime = require('./src/realtime');
const env = require('./src/config/env');
const { connectDb } = require('./src/config/db');
const { runBootstrap } = require('./src/services/bootstrap.service');
const { startScheduler: startRiskScans } = require('./src/services/riskDetection.service');
const { start: startDiamondFeed } = require('./src/services/diamondSync.service');

async function start() {
  await connectDb();
  console.log('Connected to MongoDB'); // eslint-disable-line no-console

  await runBootstrap();
  // Risk detection runs shortly after boot and every 10 minutes (riskDetection.service.js).
  startRiskScans();
  // Real cricket fixtures and prices from the Diamond feed (no-op without DIAMOND_API_KEY).
  startDiamondFeed();

  // One HTTP server for the REST API and the Socket.IO live updates.
  const server = http.createServer(app);
  realtime.init(server);
  server.listen(env.port, () => {
    console.log(`Auth/authorization API listening on port ${env.port}`); // eslint-disable-line no-console
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err); // eslint-disable-line no-console
  process.exit(1);
});
