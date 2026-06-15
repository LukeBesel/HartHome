const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { logActivity } = require('../helpers');

const router = express.Router();

// The family bulletin / chat — short broadcast messages everyone sees on the
// home screen and wall display.
router.get('/', (req, res) => {
  res.json(db.prepare(
    `SELECT an.*, u.display_name as author_name, u.avatar_color FROM announcements an
     LEFT JOIN users u ON u.id = an.author_id
     WHERE an.household_id = ? ORDER BY an.created_at DESC LIMIT 50`
  ).all(req.householdId));
});

router.post('/', (req, res) => {
  if (!req.body.body) return res.status(400).json({ error: 'Message is required' });
  const id = uuid();
  db.prepare('INSERT INTO announcements (id, household_id, author_id, body) VALUES (?, ?, ?, ?)')
    .run(id, req.householdId, req.user.id, req.body.body);
  logActivity(req.householdId, req.user, 'announcement', `posted: "${String(req.body.body).slice(0, 60)}"`);
  res.status(201).json(db.prepare(
    `SELECT an.*, u.display_name as author_name, u.avatar_color FROM announcements an
     LEFT JOIN users u ON u.id = an.author_id WHERE an.id = ?`
  ).get(id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ? AND household_id = ?').run(req.params.id, req.householdId);
  res.json({ ok: true });
});

// Activity feed (read-only).
router.get('/activity/feed', (req, res) => {
  res.json(db.prepare('SELECT * FROM activity WHERE household_id = ? ORDER BY created_at DESC LIMIT 100').all(req.householdId));
});

module.exports = router;
