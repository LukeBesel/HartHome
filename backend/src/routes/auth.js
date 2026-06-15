const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { hashPassword, verifyPassword, generateToken, requireAuth } = require('../middleware/auth');
const { seedHousehold } = require('../seed');

const router = express.Router();

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
  const { member_id } = req.body;
  const member = db.prepare('SELECT * FROM users WHERE id = ? AND household_id = ?')
    .get(member_id, req.householdId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  const token = createSession(member.id);
  res.json({ token, user: publicUser(member) });
});

// ─── Current user + household ─────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const household = db.prepare('SELECT * FROM households WHERE id = ?').get(req.householdId);
  res.json({ ...publicUser(user), household_name: household?.name, household });
});

// ─── Log out ──────────────────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.user.session_id);
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
