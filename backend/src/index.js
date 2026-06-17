// Load local .env if present (production platforms inject env vars directly).
try { require('dotenv').config(); } catch { /* dotenv optional */ }

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { config, validate, banner } = require('./config');
const { requireAuth } = require('./middleware/auth');
const db = require('./db');
const { bus } = require('./bus');

const { router: authRouter } = require('./routes/auth');
const membersRouter      = require('./routes/members');
const dashboardRouter    = require('./routes/dashboard');
const eventsRouter       = require('./routes/events');
const choresRouter       = require('./routes/chores');
const goalsRouter        = require('./routes/goals');
const rewardsRouter      = require('./routes/rewards');
const listsRouter        = require('./routes/lists');
const mealsRouter        = require('./routes/meals');
const billsRouter        = require('./routes/bills');
const financeRouter      = require('./routes/finance');
const utilitiesRouter    = require('./routes/utilities');
const assetsRouter       = require('./routes/assets');
const contactsRouter     = require('./routes/contacts');
const notesRouter        = require('./routes/notes');
const documentsRouter    = require('./routes/documents');
const devicesRouter      = require('./routes/devices');
const announcementsRouter = require('./routes/announcements');
const photosRouter       = require('./routes/photos');
const remindersRouter    = require('./routes/reminders');
const { router: ssoRouter, verify: ssoVerify, linkAuth } = require('./routes/sso');
const integrationsRouter = require('./routes/integrations');
const themesRouter       = require('./routes/themes');

// ─── Startup validation ─────────────────────────────────────────────────────
const { warnings, errors } = validate();
console.log(banner());
for (const w of warnings) console.warn(`  ⚠  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`  ✖  ${e}`);
  console.error('\nRefusing to start with the above configuration errors.\n');
  process.exit(1);
}

const app = express();
const PORT = config.port;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS: same-origin always allowed; in production extra origins come from config.
function corsDelegate(req, cb) {
  if (!config.isProd) return cb(null, { origin: true, credentials: true });
  const reqOrigin = req.headers.origin;
  if (!reqOrigin) return cb(null, { origin: true, credentials: true });
  const allow = new Set(config.allowedOrigins);
  if (config.appUrl) allow.add(config.appUrl);
  let sameOrigin = false;
  try { sameOrigin = new URL(reqOrigin).host === req.headers.host; } catch { /* malformed */ }
  cb(null, { origin: sameOrigin || allow.has(reqOrigin), credentials: true });
}
app.use(cors(corsDelegate));

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
  next();
});

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.', code: 'RATE_LIMITED' },
});

app.get('/api/health', (_req, res) => {
  let dbOk = true;
  try { require('./db').prepare('SELECT 1').get(); } catch { dbOk = false; }
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use(express.json({ limit: '15mb' })); // headroom for document/wallpaper uploads (data URLs)

app.use('/api/auth/login',  authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/demo',   authLimiter);
app.use('/api', generalLimiter);

app.use('/api/auth', authRouter);            // public

// ─── Cross-app SSO verify (public, CORS-open for sister Hart apps) ────────────
app.options('/api/sso/verify', (_req, res) => res.set('Access-Control-Allow-Origin', '*').set('Access-Control-Allow-Methods', 'GET').end());
app.get('/api/sso/verify', ssoVerify);

// Read API for connected sister apps — authenticated by an integration link
// token (not a session), CORS-open so HartCare can call it.
app.use('/api/integrations', linkAuth, integrationsRouter);

// ─── Live updates (Server-Sent Events) ────────────────────────────────────────
// EventSource can't send an Authorization header, so the session token comes in
// as a query param. Pushes a tiny "changed" ping (scoped to the household) so
// wall displays and dashboards refresh the instant data changes.
app.get('/api/stream', (req, res) => {
  const token = req.query.token;
  const row = token && db.prepare(
    `SELECT u.household_id FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND u.is_active = 1`
  ).get(token);
  if (!row) return res.status(401).end();

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.();
  res.write(': connected\n\n');

  const onChange = (evt) => { if (evt.householdId === row.household_id) res.write(`data: ${JSON.stringify({ table: evt.table })}\n\n`); };
  bus.on('change', onChange);
  const heartbeat = setInterval(() => res.write(': hb\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); bus.off('change', onChange); });
});

app.use('/api', requireAuth);                // everything below requires a session
app.use('/api/members',       membersRouter);
app.use('/api/dashboard',     dashboardRouter);
app.use('/api/events',        eventsRouter);
app.use('/api/chores',        choresRouter);
app.use('/api/goals',         goalsRouter);
app.use('/api/rewards',       rewardsRouter);
app.use('/api/lists',         listsRouter);
app.use('/api/meals',         mealsRouter);
app.use('/api/bills',         billsRouter);
app.use('/api/finance',       financeRouter);
app.use('/api/utilities',     utilitiesRouter);
app.use('/api/assets',        assetsRouter);
app.use('/api/contacts',      contactsRouter);
app.use('/api/notes',         notesRouter);
app.use('/api/documents',     documentsRouter);
app.use('/api/devices',       devicesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/photos',        photosRouter);
app.use('/api/reminders',     remindersRouter);
app.use('/api/sso',           ssoRouter);
app.use('/api/themes',        themesRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));

// ─── Static frontend + SPA fallback ─────────────────────────────────────────
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      else if (/[/\\]assets[/\\]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── Central error handler ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[error]', req.method, req.originalUrl, '-', err.message);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error: config.isProd ? 'Internal server error' : err.message,
    code: err.code || 'INTERNAL_ERROR',
  });
});

// Only bind a port when started directly (`node src/index.js`). Imported by the
// test suite, the app is mounted on an ephemeral port instead.
if (require.main === module) {
  const server = app.listen(PORT, () => console.log(`HartHome backend running on http://localhost:${PORT}`));

  process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
  process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

  function shutdown(signal) {
    console.log(`\n${signal} received — shutting down gracefully…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
