const express = require('express');
const db = require('../db');
const { crudRouter } = require('../crud');

const router = express.Router();

// Meter readings under a utility; filtered via ?utility_id=.
router.use('/readings', crudRouter({
  table: 'utility_readings',
  fields: ['utility_id', 'reading', 'cost', 'period'],
  filters: ['utility_id'],
  orderBy: 'recorded_at DESC',
}));

router.use(crudRouter({
  table: 'utilities',
  fields: ['name', 'provider', 'type', 'account_number', 'monthly_estimate', 'unit', 'contact'],
  filters: ['type'],
  orderBy: 'name ASC',
  label: 'utility',
}));

module.exports = router;
