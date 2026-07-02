const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/dashboard — one aggregated payload powering both the home screen and
// the wall-display kiosk, so a screen needs a single request to render.
router.get('/', (req, res) => {
  const hid = req.householdId;
  // When the household's finance passcode is set, children get no money data —
  // matching the server-side financeGuard on the money APIs.
  const financeHidden = req.user.role === 'child' &&
    !!db.prepare('SELECT finance_pin FROM households WHERE id = ?').get(hid)?.finance_pin;
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const members = db.prepare(
    'SELECT id, display_name, role, avatar_color, points, birthday FROM users WHERE household_id = ? AND is_active = 1 ORDER BY points DESC'
  ).all(hid);

  const todayEvents = db.prepare(
    `SELECT * FROM events WHERE household_id = ? AND date(start_at) = date('now') ORDER BY all_day DESC, start_at`
  ).all(hid);

  const upcomingEvents = db.prepare(
    `SELECT * FROM events WHERE household_id = ? AND date(start_at) > date('now') AND date(start_at) <= ?
     ORDER BY start_at LIMIT 8`
  ).all(hid, weekEnd);

  const choresDue = db.prepare(
    `SELECT * FROM chores WHERE household_id = ? AND status = 'todo'
     ORDER BY due_date IS NULL, due_date ASC LIMIT 12`
  ).all(hid);

  const billsDue = db.prepare(
    `SELECT * FROM bills WHERE household_id = ? AND status != 'paid'
     ORDER BY next_due IS NULL, next_due ASC LIMIT 8`
  ).all(hid);

  const goals = db.prepare(
    `SELECT * FROM goals WHERE household_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 6`
  ).all(hid);

  const maintenanceDue = db.prepare(
    `SELECT m.*, a.name as asset_name FROM maintenance m
     JOIN assets a ON a.id = m.asset_id
     WHERE m.household_id = ? AND m.status != 'done'
     ORDER BY m.due_date IS NULL, m.due_date ASC LIMIT 6`
  ).all(hid);

  const groceryLists = db.prepare(
    `SELECT l.id, l.name, l.type,
            (SELECT COUNT(*) FROM list_items i WHERE i.list_id = l.id AND i.done = 0) as open_items
     FROM lists l WHERE l.household_id = ? ORDER BY l.created_at`
  ).all(hid);

  const activity = db.prepare(
    'SELECT * FROM activity WHERE household_id = ? ORDER BY created_at DESC LIMIT 12'
  ).all(hid);

  const announcements = db.prepare(
    `SELECT an.*, u.display_name as author_name, u.avatar_color FROM announcements an
     LEFT JOIN users u ON u.id = an.author_id
     WHERE an.household_id = ? ORDER BY an.created_at DESC LIMIT 5`
  ).all(hid);

  const notes = db.prepare(
    `SELECT * FROM notes WHERE household_id = ? ORDER BY pinned DESC, updated_at DESC LIMIT 6`
  ).all(hid);

  // ── Financial snapshot for the current month ──
  const netWorth = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN type IN ('loan','credit') THEN -balance ELSE balance END),0) v FROM accounts WHERE household_id = ?`
  ).get(hid).v;
  const monthSpend = db.prepare(
    `SELECT COALESCE(SUM(amount),0) v FROM transactions WHERE household_id = ? AND type='expense' AND strftime('%Y-%m', date) = strftime('%Y-%m','now')`
  ).get(hid).v;
  const monthIncome = db.prepare(
    `SELECT COALESCE(SUM(amount),0) v FROM transactions WHERE household_id = ? AND type='income' AND strftime('%Y-%m', date) = strftime('%Y-%m','now')`
  ).get(hid).v;
  const billsTotal = db.prepare(
    `SELECT COALESCE(SUM(amount),0) v FROM bills WHERE household_id = ? AND status != 'paid'`
  ).get(hid).v;

  // Anyone with a birthday in the next 14 days.
  const birthdays = members.filter(m => {
    if (!m.birthday) return false;
    const b = new Date(m.birthday);
    const now = new Date();
    const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (next < now) next.setFullYear(now.getFullYear() + 1);
    return (next - now) / 864e5 <= 14;
  });

  res.json({
    today,
    members,
    todayEvents,
    upcomingEvents,
    choresDue,
    billsDue: financeHidden ? [] : billsDue,
    goals,
    maintenanceDue,
    groceryLists,
    activity,
    announcements,
    notes,
    birthdays,
    financeHidden,
    finance: financeHidden
      ? { netWorth: 0, monthSpend: 0, monthIncome: 0, billsTotal: 0 }
      : { netWorth, monthSpend, monthIncome, billsTotal },
    counts: {
      chores: choresDue.length,
      bills: financeHidden ? 0 : billsDue.length,
      events: todayEvents.length,
      grocery: groceryLists.reduce((s, l) => s + l.open_items, 0),
    },
  });
});

// Lightweight household pulse for the leaderboard / points race.
router.get('/leaderboard', (req, res) => {
  const period = req.query.period === 'week' ? "AND completed_at >= datetime('now','-7 days')"
    : req.query.period === 'month' ? "AND completed_at >= datetime('now','-30 days')" : '';
  const rows = db.prepare(
    `SELECT u.id, u.display_name, u.avatar_color, u.points as total_points,
            COALESCE((SELECT SUM(points) FROM chore_completions c WHERE c.member_id = u.id ${period}),0) as earned,
            COALESCE((SELECT COUNT(*) FROM chore_completions c WHERE c.member_id = u.id ${period}),0) as chores_done
     FROM users u WHERE u.household_id = ? AND u.is_active = 1
     ORDER BY earned DESC, total_points DESC`
  ).all(req.householdId);
  res.json(rows);
});

module.exports = router;
