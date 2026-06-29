const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { emitChange } = require('../bus');

const router = express.Router();

// ─── Privacy model ────────────────────────────────────────────────────────────
// Health data is the most sensitive in HartHome. A member always sees their own.
// Otherwise visibility depends on the member's share level:
//   private (default) → only them
//   parents           → them + parents/owner
//   household         → everyone in the household
// Children are managed by parents (so parents/owner can always view+log a child).
function getMember(id, hid) {
  return db.prepare('SELECT id, display_name, role, avatar_color, health_share FROM users WHERE id = ? AND household_id = ? AND is_active = 1').get(id, hid);
}
const isParent = (u) => u.role === 'owner' || u.role === 'parent';
function canView(viewer, target) {
  if (!target) return false;
  if (viewer.id === target.id) return true;
  if (target.role === 'child' && isParent(viewer)) return true;
  if (target.health_share === 'household') return true;
  if (target.health_share === 'parents' && isParent(viewer)) return true;
  return false;
}
function canEdit(viewer, target) {
  if (!target) return false;
  return viewer.id === target.id || (target.role === 'child' && isParent(viewer));
}

// Members the current user may open in the health module (for the switcher).
router.get('/members', (req, res) => {
  const all = db.prepare('SELECT id, display_name, role, avatar_color, health_share FROM users WHERE household_id = ? AND is_active = 1 ORDER BY created_at').all(req.householdId);
  res.json(all.filter(m => canView(req.user, m)).map(m => ({
    id: m.id, display_name: m.display_name, role: m.role, avatar_color: m.avatar_color,
    health_share: m.health_share, can_edit: canEdit(req.user, m), is_self: m.id === req.user.id,
  })));
});

// Set MY share level (or a parent setting a child's).
router.put('/share', (req, res) => {
  const targetId = req.body.member_id || req.user.id;
  const target = getMember(targetId, req.householdId);
  if (!target || !canEdit(req.user, target)) return res.status(403).json({ error: 'Not allowed' });
  const level = ['private', 'parents', 'household'].includes(req.body.level) ? req.body.level : 'private';
  db.prepare('UPDATE users SET health_share = ? WHERE id = ?').run(level, target.id);
  res.json({ ok: true, health_share: level });
});

function requireView(req, res) {
  const id = req.query.member_id || req.body.member_id || req.user.id;
  const target = getMember(id, req.householdId);
  if (!canView(req.user, target)) { res.status(403).json({ error: 'This member keeps their health private.', code: 'HEALTH_PRIVATE' }); return null; }
  return target;
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
router.get('/logs', (req, res) => {
  const target = requireView(req, res); if (!target) return;
  const where = ['household_id = ?', 'member_id = ?']; const params = [req.householdId, target.id];
  if (req.query.type) { where.push('type = ?'); params.push(req.query.type); }
  if (req.query.days) { where.push(`logged_at >= datetime('now', ?)`); params.push(`-${parseInt(req.query.days, 10) || 30} days`); }
  res.json(db.prepare(`SELECT * FROM health_logs WHERE ${where.join(' AND ')} ORDER BY logged_at DESC LIMIT 500`).all(...params));
});

router.post('/logs', (req, res) => {
  const id = req.body.member_id || req.user.id;
  const target = getMember(id, req.householdId);
  if (!canEdit(req.user, target)) return res.status(403).json({ error: 'Not allowed' });
  const { type, value, text, unit, logged_at } = req.body;
  if (!type) return res.status(400).json({ error: 'A log type is required.' });
  const newId = uuid();
  db.prepare(`INSERT INTO health_logs (id, household_id, member_id, type, value, text, unit, logged_at)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(newId, req.householdId, target.id, type, value != null ? Number(value) : null, text || '', unit || '', logged_at || new Date().toISOString());
  emitChange(req.householdId, 'health');
  res.status(201).json(db.prepare('SELECT * FROM health_logs WHERE id = ?').get(newId));
});

router.delete('/logs/:id', (req, res) => {
  const log = db.prepare('SELECT * FROM health_logs WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!log) return res.status(404).json({ error: 'Not found' });
  const target = getMember(log.member_id, req.householdId);
  if (!canEdit(req.user, target)) return res.status(403).json({ error: 'Not allowed' });
  db.prepare('DELETE FROM health_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Goals ────────────────────────────────────────────────────────────────────
router.get('/goals', (req, res) => {
  const target = requireView(req, res); if (!target) return;
  res.json(db.prepare('SELECT * FROM health_goals WHERE household_id = ? AND member_id = ? ORDER BY type').all(req.householdId, target.id));
});
router.post('/goals', (req, res) => {
  const id = req.body.member_id || req.user.id;
  const target = getMember(id, req.householdId);
  if (!canEdit(req.user, target)) return res.status(403).json({ error: 'Not allowed' });
  // One goal per type per member — upsert.
  db.prepare('DELETE FROM health_goals WHERE household_id = ? AND member_id = ? AND type = ?').run(req.householdId, target.id, req.body.type);
  const newId = uuid();
  db.prepare('INSERT INTO health_goals (id, household_id, member_id, type, target, unit, period) VALUES (?,?,?,?,?,?,?)')
    .run(newId, req.householdId, target.id, req.body.type, Number(req.body.target) || 0, req.body.unit || '', req.body.period || 'day');
  res.status(201).json(db.prepare('SELECT * FROM health_goals WHERE id = ?').get(newId));
});
router.delete('/goals/:id', (req, res) => {
  const g = db.prepare('SELECT * FROM health_goals WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!g) return res.status(404).json({ error: 'Not found' });
  const target = getMember(g.member_id, req.householdId);
  if (!canEdit(req.user, target)) return res.status(403).json({ error: 'Not allowed' });
  db.prepare('DELETE FROM health_goals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Summary (today's metrics + goal progress + trends) ───────────────────────
const SUM_TYPES = new Set(['water', 'workout']);            // additive across the day
const LATEST_TYPES = new Set(['weight', 'sleep', 'mood', 'steps']); // a single reading

router.get('/summary', (req, res) => {
  const target = requireView(req, res); if (!target) return;
  const mid = target.id;
  const todayTotal = (type) => {
    if (SUM_TYPES.has(type)) return db.prepare(`SELECT COALESCE(SUM(value),0) v FROM health_logs WHERE member_id=? AND type=? AND date(logged_at)=date('now')`).get(mid, type).v;
    const row = db.prepare(`SELECT value v FROM health_logs WHERE member_id=? AND type=? AND date(logged_at)=date('now') ORDER BY logged_at DESC LIMIT 1`).get(mid, type);
    return row ? row.v : null;
  };
  const goals = db.prepare('SELECT * FROM health_goals WHERE member_id = ?').all(mid);
  const latestWeight = db.prepare(`SELECT value, unit, logged_at FROM health_logs WHERE member_id=? AND type='weight' ORDER BY logged_at DESC LIMIT 1`).get(mid);
  const latestMood = db.prepare(`SELECT text, value FROM health_logs WHERE member_id=? AND type='mood' AND date(logged_at)=date('now') ORDER BY logged_at DESC LIMIT 1`).get(mid);

  // 30-day weight trend + 7-day steps/water bars.
  const weightTrend = db.prepare(`SELECT date(logged_at) d, value v FROM health_logs WHERE member_id=? AND type='weight' AND logged_at>=datetime('now','-90 days') ORDER BY logged_at`).all(mid);
  const days7 = db.prepare(`
    SELECT date(logged_at) d, type,
           SUM(value) s, MAX(value) m
    FROM health_logs WHERE member_id=? AND type IN ('steps','water','sleep') AND logged_at>=datetime('now','-6 days')
    GROUP BY date(logged_at), type`).all(mid);

  res.json({
    member: { id: target.id, display_name: target.display_name, avatar_color: target.avatar_color, health_share: target.health_share, can_edit: canEdit(req.user, target) },
    today: {
      water: todayTotal('water'), steps: todayTotal('steps'), sleep: todayTotal('sleep'),
      workout: todayTotal('workout'), mood: latestMood || null,
    },
    weight: latestWeight || null,
    goals,
    trends: { weight: weightTrend, week: days7 },
  });
});

// ─── Opt-in family challenges (only members sharing 'household') ───────────────
router.get('/challenge', (req, res) => {
  const type = req.query.type === 'water' ? 'water' : 'steps';
  const since = req.query.period === 'day' ? "-0 days" : "-6 days";
  const sharers = db.prepare(`SELECT id, display_name, avatar_color FROM users WHERE household_id=? AND is_active=1 AND health_share='household'`).all(req.householdId);
  const rows = sharers.map(s => {
    const agg = db.prepare(`SELECT COALESCE(${type === 'steps' ? 'SUM(value)' : 'SUM(value)'},0) total FROM health_logs WHERE member_id=? AND type=? AND logged_at>=datetime('now', ?)`)
      .get(s.id, type, since);
    return { ...s, total: agg.total };
  }).sort((a, b) => b.total - a.total);
  res.json({ type, period: req.query.period === 'day' ? 'day' : 'week', leaderboard: rows });
});

module.exports = router;
