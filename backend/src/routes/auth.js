const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { hashPassword, verifyPassword, generateToken, requireAuth } = require('../middleware/auth');
const { seedHousehold } = require('../seed');
const { config } = require('../config');

const router = express.Router();

// Public: which optional sign-in methods are live (drives the login UI).
router.get('/config', (_req, res) => res.json({ google: config.google.configured }));

// ─── Google sign-in (OAuth) ───────────────────────────────────────────────────
// Activates automatically once GOOGLE_CLIENT_ID/SECRET are set. Register the
// redirect URI <APP_URL>/api/auth/google/callback in the Google Cloud console.
function baseUrl(req) {
  return config.appUrl || `${req.protocol}://${req.get('host')}`;
}
router.get('/google', (req, res) => {
  if (!config.google.configured) return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: `${baseUrl(req)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const fail = (msg) => res.redirect(`/login?error=${encodeURIComponent(msg || 'google')}`);
  if (!config.google.configured || !req.query.code) return fail('google');
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code),
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: `${baseUrl(req)}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tok = await tokenRes.json();
    if (!tok.access_token) return fail('google');
    const profRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const prof = await profRes.json();
    const email = (prof.email || '').toLowerCase();
    if (!email) return fail('google');

    let user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    if (!user) {
      // First time → spin up a household with this person as owner.
      const householdId = uuid(); const userId = uuid();
      const name = prof.name || prof.given_name || email.split('@')[0];
      db.transaction(() => {
        db.prepare('INSERT INTO households (id, name, invite_code) VALUES (?,?,?)')
          .run(householdId, `${(prof.given_name || name)}'s Home`, Math.random().toString(36).slice(2, 8).toUpperCase());
        db.prepare(`INSERT INTO users (id, household_id, email, display_name, role, avatar_color) VALUES (?,?,?,?,'owner',?)`)
          .run(userId, householdId, email, name, AVATAR_COLORS[0]);
      })();
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }
    const token = createSession(user.id);
    res.redirect(`/login?token=${token}`);
  } catch (err) {
    console.error('[google] callback failed:', err.message);
    fail('google');
  }
});

const SESSION_DAYS = 30;
const AVATAR_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#3b82f6'];

function createSession(userId) {
  const token = generateToken();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at)
     VALUES (?, ?, ?, datetime('now', '+${SESSION_DAYS} days'))`
  ).run(uuid(), userId, token);
  return token;
}

function publicUser(u) {
  return {
    id: u.id, email: u.email, display_name: u.display_name, role: u.role,
    avatar_color: u.avatar_color, points: u.points, household_id: u.household_id,
    birthday: u.birthday,
  };
}

function shortCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Sign up — creates a brand-new household, owner becomes the first member ──
router.post('/signup', (req, res) => {
  const { householdName, displayName, email, password } = req.body;
  if (!householdName || !displayName || !email || !password) {
    return res.status(400).json({ error: 'Household name, your name, email and password are all required.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const householdId = uuid();
  const userId = uuid();
  db.transaction(() => {
    db.prepare('INSERT INTO households (id, name, invite_code) VALUES (?, ?, ?)')
      .run(householdId, householdName, shortCode());
    db.prepare(
      `INSERT INTO users (id, household_id, email, password_hash, display_name, role, avatar_color)
       VALUES (?, ?, ?, ?, ?, 'owner', ?)`
    ).run(userId, householdId, email.toLowerCase(), hashPassword(password), displayName, AVATAR_COLORS[0]);
  })();

  const token = createSession(userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.status(201).json({ token, user: publicUser(user) });
});

// ─── Look up a household by invite code (public — powers the join screen) ─────
router.get('/invite/:code', (req, res) => {
  const hh = db.prepare('SELECT id, name FROM households WHERE invite_code = ?').get(String(req.params.code).toUpperCase().trim());
  if (!hh) return res.status(404).json({ error: 'That invite code is not valid.' });
  res.json({ household_name: hh.name });
});

// ─── Join an existing household with an invite code ───────────────────────────
router.post('/join', (req, res) => {
  const { inviteCode, displayName, email, password } = req.body;
  if (!inviteCode || !displayName || !email || !password) {
    return res.status(400).json({ error: 'Invite code, your name, email and password are all required.' });
  }
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const hh = db.prepare('SELECT * FROM households WHERE invite_code = ?').get(String(inviteCode).toUpperCase().trim());
  if (!hh) return res.status(404).json({ error: 'That invite code is not valid.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const userId = uuid();
  const count = db.prepare('SELECT COUNT(*) c FROM users WHERE household_id = ?').get(hh.id).c;
  db.prepare(
    `INSERT INTO users (id, household_id, email, password_hash, display_name, role, avatar_color)
     VALUES (?, ?, ?, ?, ?, 'parent', ?)`
  ).run(userId, hh.id, email.toLowerCase(), hashPassword(password), displayName, AVATAR_COLORS[count % AVATAR_COLORS.length]);

  const token = createSession(userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.status(201).json({ token, user: publicUser(user) });
});

// ─── Explore the demo home ────────────────────────────────────────────────────
// Spins up a brand-new, fully-populated demo household for the visitor and logs
// them straight in. Each visitor gets their own isolated, mutable copy — so the
// button works everywhere (including production where SEED_DEMO_DATA is off) and
// no one steps on anyone else's data. The owner is a password-less sandbox
// account reachable only via the returned session token.
router.post('/demo', (req, res) => {
  try {
    const stamp = Math.random().toString(36).slice(2, 8);
    const { ownerId } = seedHousehold(db, {
      name: 'The Hart Family',
      ownerEmail: `demo+${stamp}@harthome.demo`,
    });
    const token = createSession(ownerId);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(ownerId);
    res.status(201).json({ token, user: publicUser(user), demo: true });
  } catch (err) {
    console.error('[demo] failed to create sandbox:', err.message);
    res.status(500).json({ error: 'Could not start the demo. Please try again.' });
  }
});

// ─── Log in ───────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(String(email).toLowerCase());
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

// ─── PIN sign-in for kids on a shared screen (no password) ────────────────────
// Children can switch profiles on a wall display by tapping their avatar; the
// returned token is short-lived and scoped to the same household.
router.post('/switch-profile', requireAuth, (req, res) => {
  const { member_id, pin } = req.body;
  const member = db.prepare('SELECT * FROM users WHERE id = ? AND household_id = ? AND is_active = 1')
    .get(member_id, req.householdId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  // A profile with a PIN set requires it (keeps kids out of a parent's profile).
  if (member.pin && String(pin || '') !== String(member.pin)) {
    return res.status(403).json({ error: 'Incorrect PIN', code: 'BAD_PIN' });
  }
  const token = createSession(member.id);
  res.json({ token, user: publicUser(member) });
});

// Which household profiles have a PIN — so the kiosk knows when to prompt.
// (Returns no PIN values, just whether each member is protected.)
router.get('/profiles', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT id, display_name, avatar_color, role, points FROM users WHERE household_id = ? AND is_active = 1 ORDER BY created_at'
  ).all(req.householdId);
  const protectedIds = new Set(db.prepare('SELECT id FROM users WHERE household_id = ? AND pin IS NOT NULL').all(req.householdId).map(r => r.id));
  res.json(rows.map(r => ({ ...r, has_pin: protectedIds.has(r.id) })));
});

// Set or clear a profile PIN. Anyone can set their own; parents can set any.
router.post('/set-pin', requireAuth, (req, res) => {
  const { member_id, pin } = req.body;
  const target = member_id || req.user.id;
  const isSelf = target === req.user.id;
  const isParent = req.user.role === 'owner' || req.user.role === 'parent';
  if (!isSelf && !isParent) return res.status(403).json({ error: 'Only a parent can set another profile\'s PIN.' });
  const member = db.prepare('SELECT * FROM users WHERE id = ? AND household_id = ?').get(target, req.householdId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  const clean = pin === null || pin === '' ? null : String(pin).replace(/\D/g, '').slice(0, 8);
  if (clean !== null && clean.length < 4) return res.status(400).json({ error: 'PIN must be 4–8 digits.' });
  db.prepare('UPDATE users SET pin = ? WHERE id = ?').run(clean, target);
  res.json({ ok: true, has_pin: clean !== null });
});

// ─── Current user + household ─────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const row = db.prepare('SELECT * FROM households WHERE id = ?').get(req.householdId);
  // Strip the finance passcode hash; expose only a locked flag.
  const household = row ? (({ finance_pin, ...rest }) => ({ ...rest, finance_locked: !!finance_pin }))(row) : row;
  res.json({ ...publicUser(user), household_name: household?.name, household });
});

// ─── Log out ──────────────────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.user.session_id);
  res.json({ ok: true });
});

// ─── Password reset ───────────────────────────────────────────────────────────
// POST /forgot — always answers ok (no account enumeration). Creates a 1-hour
// single-use token; emailed when SMTP is configured, otherwise the link is
// written to the server logs for self-hosted admins.
router.post('/forgot', (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  res.json({ ok: true }); // answer immediately, identically, every time
  if (!email) return;
  const user = db.prepare('SELECT id, display_name FROM users WHERE email = ? AND is_active = 1').get(email);
  if (!user) return;
  const token = generateToken();
  db.prepare(`INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))`)
    .run(uuid(), user.id, token);
  const base = require('../config').config.appUrl || `http://localhost:${require('../config').config.port}`;
  const link = `${base}/reset-password?token=${token}`;
  require('../mailer').sendMail({
    to: email,
    subject: 'Reset your HartHome password',
    text: `Hi ${user.display_name},\n\nSomeone asked to reset the password for this HartHome account. If that was you, open this link within 1 hour:\n\n${link}\n\nIf it wasn't you, ignore this message — nothing changes.`,
  });
});

// POST /reset — exchange a valid token for a new password. Revokes every
// existing session for the account.
router.post('/reset', (req, res) => {
  const { token, password } = req.body;
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const row = token && db.prepare(
    `SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime('now')`
  ).get(token);
  if (!row) return res.status(400).json({ error: 'That reset link is invalid or has expired. Request a new one.', code: 'BAD_RESET_TOKEN' });
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), row.user_id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id); // sign out everywhere
  })();
  res.json({ ok: true });
});

// ─── Change password ──────────────────────────────────────────────────────────
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.password_hash && !verifyPassword(currentPassword || '', user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), req.user.id);
  res.json({ ok: true });
});

module.exports = { router, AVATAR_COLORS };
