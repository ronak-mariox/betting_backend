const app = require('./src/app');
const env = require('./src/config/env');
const { connectDb } = require('./src/config/db');
const { runBootstrap } = require('./src/services/bootstrap.service');
const { startScheduler: startRiskScans } = require('./src/services/riskDetection.service');

async function start() {
  await connectDb();
  console.log('Connected to MongoDB'); // eslint-disable-line no-console

  await runBootstrap();
  // Risk detection runs shortly after boot and every 10 minutes (riskDetection.service.js).
  startRiskScans();

  app.listen(env.port, () => {
    console.log(`Auth/authorization API listening on port ${env.port}`); // eslint-disable-line no-console
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err); // eslint-disable-line no-console
  process.exit(1);
});
