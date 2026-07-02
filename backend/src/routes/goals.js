const express = require('express');
const db = require('../db');
const { crudRouter } = require('../crud');
const { logActivity } = require('../helpers');

const router = express.Router();

// Milestones live under a goal; filtered via ?goal_id=.
router.use('/milestones', crudRouter({
  table: 'goal_milestones',
  required: ['goal_id', 'title'],
  fields: ['goal_id', 'title', 'done'],
  filters: ['goal_id'],
  orderBy: 'created_at ASC',
}));

// POST /:id/progress — nudge a goal's current value, auto-complete at target.
router.post('/:id/progress', (req, res) => {
  const goal = db.prepare('SELECT * FROM goals WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const current = req.body.current != null ? Number(req.body.current) : goal.current + Number(req.body.delta || 0);
  const status = current >= goal.target ? 'done' : 'active';
  db.prepare(`UPDATE goals SET current = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(current, status, goal.id);
  if (status === 'done' && goal.status !== 'done') {
    logActivity(req.householdId, req.user, 'goal', `reached the goal "${goal.title}" 🎉`);
  }
  res.json(db.prepare('SELECT * FROM goals WHERE id = ?').get(goal.id));
});

router.use(crudRouter({
  table: 'goals',
  required: ['title'],
  fields: ['title', 'description', 'category', 'target', 'current', 'unit', 'member_id', 'due_date', 'status'],
  filters: ['status', 'category', 'member_id'],
  orderBy: `status ASC, due_date IS NULL, due_date ASC`,
  label: 'goal',
  activity: true,
}));

module.exports = router;
