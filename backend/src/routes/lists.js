const express = require('express');
const db = require('../db');
const { crudRouter } = require('../crud');

const router = express.Router();

// List items, filtered via ?list_id=.
router.use('/items', crudRouter({
  table: 'list_items',
  fields: ['list_id', 'name', 'qty', 'category', 'note', 'assignee_id', 'done', 'sort'],
  filters: ['list_id', 'done'],
  orderBy: 'done ASC, sort ASC, created_at ASC',
}));

// DELETE /:listId/clear-done — bulk-remove checked items after a shop run.
router.delete('/:listId/clear-done', (req, res) => {
  const info = db.prepare('DELETE FROM list_items WHERE list_id = ? AND household_id = ? AND done = 1')
    .run(req.params.listId, req.householdId);
  res.json({ ok: true, removed: info.changes });
});

router.use(crudRouter({
  table: 'lists',
  fields: ['name', 'type', 'icon', 'color'],
  filters: ['type'],
  orderBy: 'created_at ASC',
  label: 'list',
}));

module.exports = router;
