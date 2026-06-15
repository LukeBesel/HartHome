// ─── Centralized environment configuration & startup validation ───────────────
// Single source of truth for every environment variable the backend reads.
// Validating here (instead of scattered process.env lookups) lets us fail fast
// on dangerous misconfiguration and print a clear startup banner.

const path = require('path');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

// In development we want the demo household + sample login accounts. In
// production that would ship publicly-known credentials, so it must be opt-in.
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA === 'true';

const config = {
  nodeEnv: NODE_ENV,
  isProd: IS_PROD,
  port: Number(process.env.PORT) || 3001,

  appUrl: process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : '',

  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean),

  // Where the SQLite database lives. On hosts with a persistent volume, point
  // this at the mounted path (e.g. /data/harthome.db) so data survives redeploys.
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'harthome.db'),

  seedDemoData: SEED_DEMO_DATA,
};

function validate() {
  const warnings = [];
  const errors = [];

  if (IS_PROD) {
    if (SEED_DEMO_DATA) {
      warnings.push(
        'SEED_DEMO_DATA=true — demo accounts (owner@harthome.demo / Demo123!) are active. ' +
        'Remove this flag before launching a live household.'
      );
    }
    if (!config.appUrl) {
      warnings.push('APP_URL is not set — CORS will only allow same-origin requests. Set it to your public URL.');
    }
    const onDefaultDbPath = config.databasePath === path.join(__dirname, '..', 'harthome.db');
    if (onDefaultDbPath) {
      warnings.push('DATABASE_PATH is not set — using the in-repo default. On most hosts this is ephemeral and your data will be LOST on redeploy. Point it at a persistent volume (e.g. /data/harthome.db).');
    }
  }

  return { warnings, errors };
}

function banner() {
  return [
    '',
    '  HartHome — starting up',
    `  ├─ environment  : ${NODE_ENV}`,
    `  ├─ database     : ${config.databasePath}`,
    `  └─ demo seeding : ${SEED_DEMO_DATA ? 'ON (sample household + accounts)' : 'off'}`,
    '',
  ].join('\n');
}

module.exports = { config, validate, banner };
