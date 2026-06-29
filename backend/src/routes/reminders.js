const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/reminders — a single, prioritized list of things that need
// attention: overdue/soon bills, due chores, overdue maintenance, today's
// remaining events, and upcoming birthdays. Powers the alerts bell and the
// optional browser notifications.
router.get('/', (req, res) => {
  const hid = req.householdId;
  const today = new Date().toISOString().slice(0, 10);
  const items = [];

  // Bills — overdue or due within 3 days.
  for (const b of db.prepare(
    `SELECT id, name, amount, next_due FROM bills
     WHERE household_id = ? AND status != 'paid' AND next_due IS NOT NULL
       AND date(next_due) <= date('now','+3 days') ORDER BY next_due`
  ).all(hid)) {
    const overdue = b.next_due < new Date().toISOString().slice(0, 10);
    items.push({ id: `bill-${b.id}`, type: 'bill', icon: 'Receipt', title: b.name,
      subtitle: `$${Number(b.amount).toFixed(2)} ${overdue ? 'overdue' : 'due soon'}`,
      severity: overdue ? 'overdue' : 'soon', link: '/bills', date: b.next_due });
  }

  // Chores — due today or overdue.
  for (const c of db.prepare(
    `SELECT id, title, assignee_id, due_date FROM chores
     WHERE household_id = ? AND status = 'todo' AND due_date IS NOT NULL
       AND date(due_date) <= date('now') ORDER BY due_date`
  ).all(hid)) {
    const overdue = c.due_date < new Date().toISOString().slice(0, 10);
    items.push({ id: `chore-${c.id}`, type: 'chore', icon: 'CheckSquare', title: c.title,
      subtitle: overdue ? 'Chore overdue' : 'Chore due today',
      severity: overdue ? 'overdue' : 'today', link: '/chores', date: c.due_date });
  }

  // Maintenance — overdue or due within 7 days.
  for (const m of db.prepare(
    `SELECT mt.id, mt.title, mt.due_date, a.name AS asset_name FROM maintenance mt
     JOIN assets a ON a.id = mt.asset_id
     WHERE mt.household_id = ? AND mt.status != 'done' AND mt.due_date IS NOT NULL
       AND date(mt.due_date) <= date('now','+7 days') ORDER BY mt.due_date`
  ).all(hid)) {
    const overdue = m.due_date < new Date().toISOString().slice(0, 10);
    items.push({ id: `maint-${m.id}`, type: 'maintenance', icon: 'Car', title: m.title,
      subtitle: `${m.asset_name} · ${overdue ? 'overdue' : 'due soon'}`,
      severity: overdue ? 'overdue' : 'soon', link: '/assets', date: m.due_date });
  }

  // Today's remaining events.
  for (const e of db.prepare(
    `SELECT id, title, start_at, all_day FROM events
     WHERE household_id = ? AND date(start_at) = date('now') ORDER BY start_at`
  ).all(hid)) {
    if (!e.all_day && e.start_at < new Date().toISOString()) continue; // already passed
    items.push({ id: `event-${e.id}`, type: 'event', icon: 'CalendarDays', title: e.title,
      subtitle: 'Today', severity: 'today', link: '/calendar', date: e.start_at });
  }

  // Upcoming birthdays (next 7 days).
  for (const u of db.prepare(
    `SELECT id, display_name, birthday FROM users WHERE household_id = ? AND is_active = 1 AND birthday IS NOT NULL`
  ).all(hid)) {
    const b = new Date(u.birthday); const now = new Date();
    const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (next < new Date(now.toDateString())) next.setFullYear(now.getFullYear() + 1);
    const days = Math.round((next - new Date(now.toDateString())) / 864e5);
    if (days >= 0 && days <= 7) {
      items.push({ id: `bday-${u.id}`, type: 'birthday', icon: 'Cake', title: `${u.display_name}'s birthday`,
        subtitle: days === 0 ? 'Today! 🎉' : `In ${days} day${days === 1 ? '' : 's'}`,
        severity: days === 0 ? 'today' : 'soon', link: '/members', date: u.birthday });
    }
  }

  // Health nudges for the current member (private to them).
  const myGoals = db.prepare(`SELECT * FROM health_goals WHERE member_id = ?`).all(req.user.id);
  for (const g of myGoals) {
    if (g.type === 'water' && g.period === 'day') {
      const got = db.prepare(`SELECT COALESCE(SUM(value),0) v FROM health_logs WHERE member_id=? AND type='water' AND date(logged_at)=date('now')`).get(req.user.id).v;
      if (got < g.target) items.push({ id: 'h-water', type: 'health', icon: 'Droplet', title: 'Drink water', subtitle: `${got}/${g.target} glasses today`, severity: 'today', link: '/health', date: today });
    }
    if (g.type === 'steps' && g.period === 'day') {
      const got = db.prepare(`SELECT COALESCE(MAX(value),0) v FROM health_logs WHERE member_id=? AND type='steps' AND date(logged_at)=date('now')`).get(req.user.id).v;
      if (got < g.target) items.push({ id: 'h-steps', type: 'health', icon: 'Footprints', title: 'Move more', subtitle: `${Math.round(got).toLocaleString()}/${g.target.toLocaleString()} steps`, severity: 'soon', link: '/health', date: today });
    }
  }
  const hasWeightGoal = myGoals.some(g => g.type === 'weight');
  if (hasWeightGoal) {
    const recent = db.prepare(`SELECT 1 FROM health_logs WHERE member_id=? AND type='weight' AND logged_at>=datetime('now','-7 days') LIMIT 1`).get(req.user.id);
    if (!recent) items.push({ id: 'h-weight', type: 'health', icon: 'Scale', title: 'Log your weight', subtitle: 'No entry this week', severity: 'soon', link: '/health', date: today });
  }

  const order = { overdue: 0, today: 1, soon: 2 };
  items.sort((a, b) => (order[a.severity] - order[b.severity]) || String(a.date).localeCompare(String(b.date)));

  res.json({ count: items.length, overdue: items.filter(i => i.severity === 'overdue').length, items });
});

module.exports = router;
