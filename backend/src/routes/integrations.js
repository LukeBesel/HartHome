const express = require('express');
const db = require('../db');

// ─── Read API for connected sister apps (e.g. HartCare) ───────────────────────
// Authenticated by an integration link token (see sso.linkAuth), scoped to the
// household. Lets HartCare surface HartHome context — family members and the
// shared calendar — so the two products feel like one. Read-only by design.

const router = express.Router();

// GET /api/integrations/context — household snapshot for the connected app.
router.get('/context', (req, res) => {
  const hid = req.householdId;
  const household = db.prepare('SELECT id, name FROM households WHERE id = ?').get(hid);
  const members = db.prepare(
    'SELECT id, display_name, avatar_color, role, birthday FROM users WHERE household_id = ? AND is_active = 1 ORDER BY created_at'
  ).all(hid);
  const eventsToday = db.prepare(
    `SELECT id, title, start_at, all_day, member_id, color FROM events
     WHERE household_id = ? AND date(start_at) = date('now') ORDER BY all_day DESC, start_at`
  ).all(hid);
  const eventsUpcoming = db.prepare(
    `SELECT id, title, start_at, all_day, member_id, color FROM events
     WHERE household_id = ? AND date(start_at) > date('now') AND date(start_at) <= date('now','+7 days')
     ORDER BY start_at LIMIT 20`
  ).all(hid);
  res.json({ app: 'harthome', household, members, events: { today: eventsToday, upcoming: eventsUpcoming } });
});

module.exports = router;
