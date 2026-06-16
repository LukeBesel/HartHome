const express = require('express');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const db = require('../db');

// ─── Cross-app single sign-on (HartHome → HartCare and other Hart apps) ───────
// HartHome is the identity hub for the family. It mints a short-lived, one-time
// hand-off token; a sister app opens with ?token=… and calls /api/sso/verify
// (public) to exchange it for the member + household identity. No shared secret
// to distribute — the token itself is the credential and is single-use.

const router = express.Router(); // mounted behind requireAuth

// POST /api/sso/handoff — issue a one-time token for the current member.
router.post('/handoff', (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare(
    `INSERT INTO sso_tokens (id, token, user_id, household_id, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', '+3 minutes'))`
  ).run(uuid(), token, req.user.id, req.householdId);
  const hh = db.prepare('SELECT hartcare_url FROM households WHERE id = ?').get(req.householdId);
  res.json({ token, hartcare_url: hh?.hartcare_url || '' });
});

// GET /api/sso/verify?token=… — PUBLIC, CORS-open. A sister app calls this to
// turn a hand-off token into identity. Single-use + short-lived.
function verify(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  const token = req.query.token;
  const row = token && db.prepare(`
    SELECT s.id, s.user_id, s.household_id,
           u.display_name, u.email, u.role, u.avatar_color,
           h.name AS household_name
    FROM sso_tokens s
    JOIN users u ON u.id = s.user_id
    JOIN households h ON h.id = s.household_id
    WHERE s.token = ? AND s.used = 0 AND s.expires_at > datetime('now')
  `).get(token);
  if (!row) return res.status(401).json({ error: 'Invalid or expired token', code: 'BAD_SSO_TOKEN' });
  db.prepare('UPDATE sso_tokens SET used = 1 WHERE id = ?').run(row.id);
  res.json({
    user: { id: row.user_id, display_name: row.display_name, email: row.email, role: row.role, avatar_color: row.avatar_color },
    household: { id: row.household_id, name: row.household_name },
    app: 'harthome',
  });
}

// Best-effort cleanup of stale tokens.
function sweep() {
  try { db.prepare("DELETE FROM sso_tokens WHERE expires_at < datetime('now', '-1 day')").run(); } catch { /* ignore */ }
}

module.exports = { router, verify, sweep };
