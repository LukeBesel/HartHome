const { v4: uuid } = require('uuid');
const db = require('./db');

// Record a line in the household activity feed (best-effort; never throws).
function logActivity(householdId, member, type, message) {
  try {
    db.prepare(
      `INSERT INTO activity (id, household_id, member_id, member_name, type, message)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuid(), householdId, member?.id || null, member?.display_name || '', type, message);
  } catch { /* activity logging is non-critical */ }
}

module.exports = { logActivity, uuid };
