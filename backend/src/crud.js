const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('./db');
const { logActivity } = require('./helpers');
const { emitChange } = require('./bus');

// ─── Generic, household-scoped CRUD router factory ────────────────────────────
// Most HartHome modules are plain collections of rows that belong to a
// household. Rather than hand-write five near-identical handlers per module,
// this factory produces a fully tenant-isolated router from a small config.
//
//   opts = {
//     table:    'chores',              // SQLite table name
//     fields:   ['title','points'],    // columns writable via POST/PUT
//     filters:  ['assignee_id'],       // query params that filter GET /
//     orderBy:  'created_at DESC',      // default sort
//     label:    'chore',               // singular, for activity messages
//     activity: false,                 // log create/delete to the feed
//     hooks:    { afterCreate, afterUpdate, beforeDelete }  // optional
//   }
//
// Every query is constrained to req.householdId, so one household can never
// read or mutate another's data even by guessing ids.

function crudRouter(opts) {
  const {
    table,
    fields,
    filters = [],
    orderBy = 'created_at DESC',
    label = 'item',
    activity = false,
    required = [],          // fields that must be non-empty on create
    hooks = {},
  } = opts;

  const router = express.Router();

  // Friendly 400 instead of a SQLite NOT NULL 500 when required fields are missing.
  function missingRequired(body) {
    for (const f of required) {
      const v = body[f];
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return f;
    }
    return null;
  }

  // GET / — list, with optional column filters from the query string.
  router.get('/', (req, res) => {
    const where = ['household_id = ?'];
    const params = [req.householdId];
    for (const f of filters) {
      if (req.query[f] !== undefined && req.query[f] !== '') {
        where.push(`${f} = ?`);
        params.push(req.query[f]);
      }
    }
    const rows = db
      .prepare(`SELECT * FROM ${table} WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`)
      .all(...params);
    res.json(rows);
  });

  // GET /:id — single row.
  router.get('/:id', (req, res) => {
    const row = db
      .prepare(`SELECT * FROM ${table} WHERE id = ? AND household_id = ?`)
      .get(req.params.id, req.householdId);
    if (!row) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    res.json(row);
  });

  // POST / — create.
  router.post('/', (req, res) => {
    const missing = missingRequired(req.body || {});
    if (missing) {
      return res.status(400).json({ error: `Please provide a ${missing.replace(/_/g, ' ')} for this ${label}.`, code: 'MISSING_FIELD', field: missing });
    }
    const id = uuid();
    const cols = ['id', 'household_id'];
    const vals = [id, req.householdId];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        cols.push(f);
        vals.push(normalize(req.body[f]));
      }
    }
    db.prepare(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...vals);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (activity) logActivity(req.householdId, req.user, table, `added a ${label}: ${row.title || row.name || ''}`.trim());
    hooks.afterCreate?.(row, req);
    emitChange(req.householdId, table);
    res.status(201).json(row);
  });

  // PUT /:id — update (partial; only provided writable fields change).
  router.put('/:id', (req, res) => {
    for (const f of required) {
      const v = (req.body || {})[f];
      if (v !== undefined && (v === null || (typeof v === 'string' && !v.trim()))) {
        return res.status(400).json({ error: `A ${f.replace(/_/g, ' ')} is required for this ${label}.`, code: 'MISSING_FIELD', field: f });
      }
    }
    const existing = db
      .prepare(`SELECT * FROM ${table} WHERE id = ? AND household_id = ?`)
      .get(req.params.id, req.householdId);
    if (!existing) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

    const sets = [];
    const vals = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        vals.push(normalize(req.body[f]));
      }
    }
    if (hasColumn(table, 'updated_at')) sets.push(`updated_at = datetime('now')`);
    if (sets.length) {
      vals.push(req.params.id, req.householdId);
      db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ? AND household_id = ?`).run(...vals);
    }
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    hooks.afterUpdate?.(row, existing, req);
    emitChange(req.householdId, table);
    res.json(row);
  });

  // DELETE /:id.
  router.delete('/:id', (req, res) => {
    const existing = db
      .prepare(`SELECT * FROM ${table} WHERE id = ? AND household_id = ?`)
      .get(req.params.id, req.householdId);
    if (!existing) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    hooks.beforeDelete?.(existing, req);
    db.prepare(`DELETE FROM ${table} WHERE id = ? AND household_id = ?`).run(req.params.id, req.householdId);
    if (activity) logActivity(req.householdId, req.user, table, `removed a ${label}: ${existing.title || existing.name || ''}`.trim());
    emitChange(req.householdId, table);
    res.json({ ok: true });
  });

  return router;
}

// Booleans → 0/1, objects/arrays → JSON, everything else passthrough.
function normalize(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

const columnCache = {};
function hasColumn(table, col) {
  if (!columnCache[table]) {
    columnCache[table] = db.prepare(`PRAGMA table_info(${table})`).all().map(r => r.name);
  }
  return columnCache[table].includes(col);
}

module.exports = { crudRouter };
