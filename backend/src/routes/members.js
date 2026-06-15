const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { hashPassword, requireRole } = require('../middleware/auth');
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

// ─── Household settings ───────────────────────────────────────────────────────
router.get('/household/info', (req, res) => {
  res.json(db.prepare('SELECT * FROM households WHERE id = ?').get(req.householdId));
});

router.put('/household/info', requireRole('parent'), (req, res) => {
  const { name, timezone, accent, address } = req.body;
  const sets = [], vals = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
  if (timezone !== undefined) { sets.push('timezone = ?'); vals.push(timezone); }
  if (accent !== undefined) { sets.push('accent = ?'); vals.push(accent); }
  if (address !== undefined) { sets.push('address = ?'); vals.push(address); }
  if (sets.length) { vals.push(req.householdId); db.prepare(`UPDATE households SET ${sets.join(', ')} WHERE id = ?`).run(...vals); }
  res.json(db.prepare('SELECT * FROM households WHERE id = ?').get(req.householdId));
});

module.exports = router;
