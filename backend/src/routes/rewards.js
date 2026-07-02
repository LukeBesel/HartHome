const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { crudRouter } = require('../crud');
const { requireRole } = require('../middleware/auth');
const { logActivity } = require('../helpers');

const router = express.Router();

// GET /redemptions — redemption history / pending approvals.
router.get('/redemptions/all', (req, res) => {
  res.json(db.prepare('SELECT * FROM reward_redemptions WHERE household_id = ? ORDER BY created_at DESC').all(req.householdId));
});

// POST /:id/redeem — a member spends points on a reward.
router.post('/:id/redeem', (req, res) => {
  const reward = db.prepare('SELECT * FROM rewards WHERE id = ? AND household_id = ? AND active = 1')
    .get(req.params.id, req.householdId);
  if (!reward) return res.status(404).json({ error: 'Reward not available' });

  const memberId = req.body.member_id || req.user.id;
  const member = db.prepare('SELECT * FROM users WHERE id = ? AND household_id = ?').get(memberId, req.householdId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (member.points < reward.cost) return res.status(400).json({ error: 'Not enough points yet.' });
  if (reward.stock === 0) return res.status(400).json({ error: 'This reward is out of stock.' });

  const id = uuid();
  db.transaction(() => {
    db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(reward.cost, member.id);
    if (reward.stock > 0) db.prepare('UPDATE rewards SET stock = stock - 1 WHERE id = ?').run(reward.id);
    db.prepare(
      `INSERT INTO reward_redemptions (id, household_id, reward_id, reward_title, member_id, cost, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).run(id, req.householdId, reward.id, reward.title, member.id, reward.cost);
  })();

  logActivity(req.householdId, member, 'reward', `redeemed "${reward.title}" for ${reward.cost} pts`);
  res.status(201).json({
    redemption: db.prepare('SELECT * FROM reward_redemptions WHERE id = ?').get(id),
    member: db.prepare('SELECT id, display_name, points FROM users WHERE id = ?').get(member.id),
  });
});

// PUT /redemptions/:id — parent approves/fulfils/denies (denying refunds points).
router.put('/redemptions/:id', requireRole('parent'), (req, res) => {
  const r = db.prepare('SELECT * FROM reward_redemptions WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body;
  if (status === 'denied' && r.status !== 'denied') {
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(r.cost, r.member_id);
  }
  db.prepare('UPDATE reward_redemptions SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM reward_redemptions WHERE id = ?').get(req.params.id));
});

router.use(crudRouter({
  table: 'rewards',
  required: ['title'],
  fields: ['title', 'description', 'cost', 'icon', 'stock', 'active'],
  filters: ['active'],
  orderBy: 'cost ASC',
  label: 'reward',
  activity: true,
}));

module.exports = router;
