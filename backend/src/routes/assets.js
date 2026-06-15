const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { crudRouter } = require('../crud');
const { logActivity } = require('../helpers');

const router = express.Router();

// POST /maintenance/:id/complete — log a service, schedule the next one if the
// task recurs (by months and/or mileage — perfect for car oil changes).
router.post('/maintenance/:id/complete', (req, res) => {
  const m = db.prepare('SELECT * FROM maintenance WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const cost = req.body.cost != null ? Number(req.body.cost) : m.cost;
  const atMileage = req.body.mileage != null ? Number(req.body.mileage) : null;

  db.transaction(() => {
    db.prepare(`UPDATE maintenance SET status='done', completed_at=datetime('now'), cost=?, updated_at=datetime('now') WHERE id=?`)
      .run(cost, m.id);

    // Track expense + odometer against the asset.
    if (cost) {
      db.prepare(`INSERT INTO transactions (id, household_id, type, amount, category, description, member_id)
                  VALUES (?, ?, 'expense', ?, 'auto & maintenance', ?, ?)`)
        .run(uuid(), req.householdId, cost, `Maintenance: ${m.title}`, req.user.id);
    }
    if (atMileage) db.prepare('UPDATE assets SET mileage = ?, updated_at=datetime(\'now\') WHERE id = ?').run(atMileage, m.asset_id);

    // Auto-schedule the recurrence.
    if (m.recurrence_months > 0 || m.recurrence_miles > 0) {
      const due = m.recurrence_months > 0
        ? new Date(Date.now() + m.recurrence_months * 30 * 864e5).toISOString().slice(0, 10) : null;
      const dueMiles = m.recurrence_miles > 0 && atMileage ? atMileage + m.recurrence_miles : m.due_mileage;
      db.prepare(
        `INSERT INTO maintenance (id, household_id, asset_id, title, type, due_date, due_mileage, recurrence_months, recurrence_miles, provider, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming')`
      ).run(uuid(), req.householdId, m.asset_id, m.title, m.type, due, dueMiles, m.recurrence_months, m.recurrence_miles, m.provider);
    }
  })();

  const asset = db.prepare('SELECT name FROM assets WHERE id = ?').get(m.asset_id);
  logActivity(req.householdId, req.user, 'maintenance', `logged "${m.title}" for ${asset?.name || 'an asset'}`);
  res.json({ ok: true });
});

router.use('/maintenance', crudRouter({
  table: 'maintenance',
  fields: ['asset_id', 'title', 'type', 'due_date', 'due_mileage', 'completed_at', 'cost', 'provider', 'recurrence_months', 'recurrence_miles', 'status', 'notes'],
  filters: ['asset_id', 'status', 'type'],
  orderBy: `status='done', due_date IS NULL, due_date ASC`,
  label: 'maintenance task',
}));

router.use(crudRouter({
  table: 'assets',
  fields: ['name', 'type', 'make', 'model', 'year', 'identifier', 'purchase_date', 'purchase_price', 'current_value', 'mileage', 'warranty_expires', 'location', 'notes', 'icon'],
  filters: ['type'],
  orderBy: 'name ASC',
  label: 'asset',
  activity: true,
}));

module.exports = router;
