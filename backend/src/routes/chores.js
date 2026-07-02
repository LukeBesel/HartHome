const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { crudRouter } = require('../crud');
const { logActivity } = require('../helpers');
const { emitChange } = require('../bus');

const router = express.Router();

// Advance a recurring chore to its next due date instead of marking it done
// forever, so daily/weekly chores reappear automatically.
function nextDue(recurrence, from) {
  const d = from ? new Date(from) : new Date();
  if (recurrence === 'daily') d.setDate(d.getDate() + 1);
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
  else return null;
  return d.toISOString().slice(0, 10);
}

// POST /:id/complete — mark done, award points to the assignee, log history.
router.post('/:id/complete', (req, res) => {
  const chore = db.prepare('SELECT * FROM chores WHERE id = ? AND household_id = ?')
    .get(req.params.id, req.householdId);
  if (!chore) return res.status(404).json({ error: 'Chore not found' });

  const memberId = req.body.member_id || chore.assignee_id;
  const member = memberId
    ? db.prepare('SELECT * FROM users WHERE id = ? AND household_id = ?').get(memberId, req.householdId)
    : null;

  db.transaction(() => {
    db.prepare(
      `INSERT INTO chore_completions (id, household_id, chore_id, chore_title, member_id, points)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuid(), req.householdId, chore.id, chore.title, memberId || null, chore.points);

    if (member) {
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(chore.points, member.id);
    }

    if (chore.recurrence && chore.recurrence !== 'once') {
      // Rotating chore: hand the next turn to the next member in the rotation.
      let nextAssignee = chore.assignee_id;
      try {
        const rota = JSON.parse(chore.rotation || '[]');
        if (Array.isArray(rota) && rota.length > 1) {
          const i = rota.indexOf(chore.assignee_id);
          nextAssignee = rota[(i + 1) % rota.length];
        }
      } catch { /* malformed rotation */ }
      // Recurring chore: roll it forward and keep it on the board.
      db.prepare(`UPDATE chores SET status='todo', assignee_id=?, last_completed_at=datetime('now'), due_date=?, updated_at=datetime('now') WHERE id=?`)
        .run(nextAssignee, nextDue(chore.recurrence, chore.due_date), chore.id);
    } else {
      db.prepare(`UPDATE chores SET status='done', last_completed_at=datetime('now'), updated_at=datetime('now') WHERE id=?`)
        .run(chore.id);
    }
  })();

  logActivity(req.householdId, member || req.user,
    'chore', `completed "${chore.title}"${chore.points ? ` (+${chore.points} pts)` : ''}`);
  emitChange(req.householdId, 'chores');

  res.json({
    ok: true,
    chore: db.prepare('SELECT * FROM chores WHERE id = ?').get(chore.id),
    member: member ? db.prepare('SELECT id, display_name, points FROM users WHERE id = ?').get(member.id) : null,
  });
});

// POST /:id/reopen — undo completion (does not refund points).
router.post('/:id/reopen', (req, res) => {
  db.prepare(`UPDATE chores SET status='todo', updated_at=datetime('now') WHERE id=? AND household_id=?`)
    .run(req.params.id, req.householdId);
  res.json({ ok: true });
});

// Standard CRUD for everything else.
router.use(crudRouter({
  table: 'chores',
  required: ['title'],
  fields: ['title', 'description', 'assignee_id', 'points', 'recurrence', 'day_of_week', 'due_date', 'status', 'icon', 'rotation'],
  filters: ['assignee_id', 'status'],
  orderBy: `status ASC, due_date IS NULL, due_date ASC, created_at DESC`,
  label: 'chore',
  activity: true,
}));

module.exports = router;
