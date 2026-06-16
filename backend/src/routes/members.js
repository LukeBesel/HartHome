const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { hashPassword, verifyPassword, requireRole } = require('../middleware/auth');
const { AVATAR_COLORS } = require('./auth');
const { logActivity } = require('../helpers');

const router = express.Router();

function publicUser(u) {
  return {
    id: u.id, email: u.email, display_name: u.display_name, role: u.role,
    avatar_color: u.avatar_color, points: u.points, birthday: u.birthday, is_active: u.is_active,
  };
}

// List all household members.
router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM users WHERE household_id = ? AND is_active = 1 ORDER BY created_at'
  ).all(req.householdId);
  res.json(rows.map(publicUser));
});

// Add a member. Parents/owners only. Email + password optional — kids can be
// profile-only (they sign in by tapping their avatar on a shared screen).
router.post('/', requireRole('parent'), (req, res) => {
  const { display_name, email, password, role = 'member', avatar_color, birthday } = req.body;
  if (!display_name) return res.status(400).json({ error: 'A name is required.' });
  if (email) {
    const dupe = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
    if (dupe) return res.status(409).json({ error: 'That email is already in use.' });
  }
  const id = uuid();
  const count = db.prepare('SELECT COUNT(*) c FROM users WHERE household_id = ?').get(req.householdId).c;
  db.prepare(
    `INSERT INTO users (id, household_id, email, password_hash, display_name, role, avatar_color, birthday)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.householdId, email ? String(email).toLowerCase() : null,
    password ? hashPassword(password) : null, display_name,
    role === 'owner' ? 'parent' : role,
    avatar_color || AVATAR_COLORS[count % AVATAR_COLORS.length], birthday || null
  );
  logActivity(req.householdId, req.user, 'member', `added ${display_name} to the household`);
  res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

// Update a member.
router.put('/:id', requireRole('parent'), (req, res) => {
  const member = db.prepare('SELECT * FROM users WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  const { display_name, role, avatar_color, birthday, email, points } = req.body;
  const sets = [], vals = [];
  if (display_name !== undefined) { sets.push('display_name = ?'); vals.push(display_name); }
  if (role !== undefined && member.role !== 'owner') { sets.push('role = ?'); vals.push(role); }
  if (avatar_color !== undefined) { sets.push('avatar_color = ?'); vals.push(avatar_color); }
  if (birthday !== undefined) { sets.push('birthday = ?'); vals.push(birthday || null); }
  if (email !== undefined) { sets.push('email = ?'); vals.push(email ? String(email).toLowerCase() : null); }
  if (points !== undefined) { sets.push('points = ?'); vals.push(Math.max(0, Math.round(points))); }
  if (sets.length) { vals.push(req.params.id); db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals); }
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)));
});

// Remove (deactivate) a member. The owner can never be removed.
router.delete('/:id', requireRole('parent'), (req, res) => {
  const member = db.prepare('SELECT * FROM users WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (member.role === 'owner') return res.status(400).json({ error: 'The household owner cannot be removed.' });
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
  logActivity(req.householdId, req.user, 'member', `removed ${member.display_name} from the household`);
  res.json({ ok: true });
});

// Never leak the finance passcode hash to clients; expose a boolean instead.
function publicHousehold(h) {
  if (!h) return h;
  const { finance_pin, ...rest } = h;
  return { ...rest, finance_locked: !!finance_pin };
}

// ─── Household settings ───────────────────────────────────────────────────────
router.get('/household/info', (req, res) => {
  res.json(publicHousehold(db.prepare('SELECT * FROM households WHERE id = ?').get(req.householdId)));
});

router.put('/household/info', requireRole('parent'), (req, res) => {
  const { name, timezone, accent, address, hartcare_url } = req.body;
  const sets = [], vals = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
  if (timezone !== undefined) { sets.push('timezone = ?'); vals.push(timezone); }
  if (accent !== undefined) { sets.push('accent = ?'); vals.push(accent); }
  if (address !== undefined) { sets.push('address = ?'); vals.push(address); }
  if (hartcare_url !== undefined) { sets.push('hartcare_url = ?'); vals.push(String(hartcare_url).trim()); }
  if (sets.length) { vals.push(req.householdId); db.prepare(`UPDATE households SET ${sets.join(', ')} WHERE id = ?`).run(...vals); }
  res.json(publicHousehold(db.prepare('SELECT * FROM households WHERE id = ?').get(req.householdId)));
});

// ─── Financial passcode ───────────────────────────────────────────────────────
// A parent sets a passcode that locks the money sections (Bills, Budget) so kids
// can browse the rest of HartHome but can't open the family finances.
router.post('/household/finance-pin', requireRole('parent'), (req, res) => {
  const { pin } = req.body;
  if (pin === null || pin === '') {
    db.prepare('UPDATE households SET finance_pin = NULL WHERE id = ?').run(req.householdId);
    return res.json({ finance_locked: false });
  }
  const clean = String(pin).replace(/\D/g, '').slice(0, 12);
  if (clean.length < 4) return res.status(400).json({ error: 'Passcode must be at least 4 digits.' });
  db.prepare('UPDATE households SET finance_pin = ? WHERE id = ?').run(hashPassword(clean), req.householdId);
  res.json({ finance_locked: true });
});

// Verify the passcode to unlock the money sections for this session.
router.post('/household/finance-unlock', (req, res) => {
  const h = db.prepare('SELECT finance_pin FROM households WHERE id = ?').get(req.householdId);
  if (!h?.finance_pin) return res.json({ ok: true }); // not locked
  if (verifyPassword(String(req.body.pin || ''), h.finance_pin)) return res.json({ ok: true });
  res.status(403).json({ error: 'Incorrect passcode', code: 'BAD_FINANCE_PIN' });
});

// ─── Per-user preferences (theme, dashboard layout, display config) ───────────
// Synced server-side so a member's customizations follow them across devices.
router.get('/me/prefs', (req, res) => {
  const row = db.prepare('SELECT preferences FROM users WHERE id = ?').get(req.user.id);
  let prefs = {};
  try { prefs = JSON.parse(row?.preferences || '{}'); } catch { /* corrupt → defaults */ }
  res.json(prefs);
});

router.put('/me/prefs', (req, res) => {
  const prefs = (req.body && typeof req.body === 'object') ? req.body : {};
  db.prepare('UPDATE users SET preferences = ? WHERE id = ?').run(JSON.stringify(prefs), req.user.id);
  res.json(prefs);
});

// Regenerate the household invite code (invalidates the old one).
router.post('/household/regenerate-invite', requireRole('parent'), (req, res) => {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  db.prepare('UPDATE households SET invite_code = ? WHERE id = ?').run(code, req.householdId);
  res.json({ invite_code: code });
});

module.exports = router;
