const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { crudRouter } = require('../crud');
const { logActivity } = require('../helpers');

const router = express.Router();

function advance(frequency, from) {
  const d = from ? new Date(from) : new Date();
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d.toISOString().slice(0, 10);
}

// POST /:id/pay — record a payment, roll recurring bills to the next cycle.
router.post('/:id/pay', (req, res) => {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  const amount = req.body.amount != null ? Number(req.body.amount) : bill.amount;

  db.transaction(() => {
    db.prepare(
      `INSERT INTO bill_payments (id, household_id, bill_id, bill_name, amount, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuid(), req.householdId, bill.id, bill.name, amount, req.body.note || '');

    // Also record it as an expense transaction so budgets stay accurate.
    db.prepare(
      `INSERT INTO transactions (id, household_id, type, amount, category, description, member_id)
       VALUES (?, ?, 'expense', ?, ?, ?, ?)`
    ).run(uuid(), req.householdId, amount, bill.category, `Bill: ${bill.name}`, req.user.id);

    if (bill.frequency && bill.frequency !== 'once') {
      db.prepare(`UPDATE bills SET status='upcoming', next_due=?, updated_at=datetime('now') WHERE id=?`)
        .run(advance(bill.frequency, bill.next_due), bill.id);
    } else {
      db.prepare(`UPDATE bills SET status='paid', updated_at=datetime('now') WHERE id=?`).run(bill.id);
    }
  })();

  logActivity(req.householdId, req.user, 'bill', `paid ${bill.name} ($${amount.toFixed(2)})`);
  res.json(db.prepare('SELECT * FROM bills WHERE id = ?').get(bill.id));
});

router.get('/payments/all', (req, res) => {
  res.json(db.prepare('SELECT * FROM bill_payments WHERE household_id = ? ORDER BY paid_at DESC LIMIT 100').all(req.householdId));
});

router.use(crudRouter({
  table: 'bills',
  required: ['name'],
  fields: ['name', 'amount', 'category', 'frequency', 'next_due', 'autopay', 'account', 'member_id', 'status', 'notes'],
  filters: ['status', 'category'],
  orderBy: `next_due IS NULL, next_due ASC`,
  label: 'bill',
  activity: true,
}));

module.exports = router;
