const express = require('express');
const db = require('../db');
const { crudRouter } = require('../crud');

const router = express.Router();

// A registered screen (wall display, tablet, TV) gets a short pairing code so a
// dumb device can pull its assigned layout from /display.
function pairingCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

router.use(crudRouter({
  table: 'devices',
  required: ['name'],
  fields: ['name', 'type', 'widgets', 'rotate_seconds'],
  filters: ['type'],
  orderBy: 'created_at ASC',
  label: 'device',
  hooks: {
    afterCreate: (row) => {
      db.prepare('UPDATE devices SET pairing_code = ? WHERE id = ?').run(pairingCode(), row.id);
      row.pairing_code = db.prepare('SELECT pairing_code FROM devices WHERE id = ?').get(row.id).pairing_code;
    },
  },
}));

module.exports = router;
