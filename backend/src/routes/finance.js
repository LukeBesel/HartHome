const express = require('express');
const db = require('../db');
const { crudRouter } = require('../crud');

const router = express.Router();

// GET /summary — budget vs. actual + cashflow for the current month.
router.get('/summary', (req, res) => {
  const hid = req.householdId;
  const accounts = db.prepare('SELECT * FROM accounts WHERE household_id = ? ORDER BY type, name').all(hid);
  const budgets = db.prepare('SELECT * FROM budgets WHERE household_id = ? ORDER BY category').all(hid);

  // Spend per category this month.
  const spendRows = db.prepare(
    `SELECT category, SUM(amount) spent FROM transactions
     WHERE household_id = ? AND type='expense' AND strftime('%Y-%m', date)=strftime('%Y-%m','now')
     GROUP BY category`
  ).all(hid);
  const spendByCat = Object.fromEntries(spendRows.map(r => [r.category, r.spent]));

  const income = db.prepare(
    `SELECT COALESCE(SUM(amount),0) v FROM transactions WHERE household_id=? AND type='income' AND strftime('%Y-%m',date)=strftime('%Y-%m','now')`
  ).get(hid).v;
  const expense = db.prepare(
    `SELECT COALESCE(SUM(amount),0) v FROM transactions WHERE household_id=? AND type='expense' AND strftime('%Y-%m',date)=strftime('%Y-%m','now')`
  ).get(hid).v;

  // Last 6 months trend.
  const trend = db.prepare(
    `SELECT strftime('%Y-%m', date) month,
            SUM(CASE WHEN type='income' THEN amount ELSE 0 END) income,
            SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) expense
     FROM transactions WHERE household_id=? AND date >= date('now','-6 months')
     GROUP BY month ORDER BY month`
  ).all(hid);

  const netWorth = accounts.reduce((s, a) => s + (a.type === 'loan' || a.type === 'credit' ? -a.balance : a.balance), 0);

  res.json({
    accounts,
    netWorth,
    budgets: budgets.map(b => ({ ...b, spent: spendByCat[b.category] || 0 })),
    spendByCategory: spendRows,
    month: { income, expense, net: income - expense },
    trend,
  });
});

router.use('/accounts', crudRouter({
  table: 'accounts',
  required: ['name'],
  fields: ['name', 'type', 'balance', 'institution'],
  filters: ['type'],
  orderBy: 'type, name',
  label: 'account',
}));

router.use('/transactions', crudRouter({
  table: 'transactions',
  fields: ['type', 'amount', 'category', 'description', 'account_id', 'member_id', 'date'],
  filters: ['type', 'category', 'account_id', 'member_id'],
  orderBy: 'date DESC, created_at DESC',
  label: 'transaction',
}));

router.use('/budgets', crudRouter({
  table: 'budgets',
  required: ['category'],
  fields: ['category', 'monthly_limit', 'icon'],
  orderBy: 'category',
  label: 'budget',
}));

module.exports = router;
