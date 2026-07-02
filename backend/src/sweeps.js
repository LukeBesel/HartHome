const db = require('./db');

// Every table that carries a household_id (kept in sync with db.js). Used to
// fully remove a household's data — SQLite has no cross-table cascade for these.
const HOUSEHOLD_TABLES = [
  'events', 'chores', 'chore_completions', 'goals', 'goal_milestones',
  'rewards', 'reward_redemptions', 'lists', 'list_items', 'recipes', 'meals',
  'bills', 'bill_payments', 'accounts', 'transactions', 'budgets',
  'utilities', 'utility_readings', 'assets', 'maintenance', 'contacts',
  'notes', 'documents', 'devices', 'announcements', 'activity', 'photos',
  'calendar_feeds', 'health_logs', 'health_goals', 'household_themes',
  'sso_tokens', 'integration_links',
];

function deleteHousehold(householdId) {
  const tx = db.transaction(() => {
    for (const t of HOUSEHOLD_TABLES) {
      try { db.prepare(`DELETE FROM ${t} WHERE household_id = ?`).run(householdId); } catch { /* table may not exist on old DBs */ }
    }
    // users + sessions cascade from the household row.
    db.prepare('DELETE FROM households WHERE id = ?').run(householdId);
  });
  tx();
}

// Periodic housekeeping. Safe to run any time; everything is best-effort.
function runSweeps() {
  try {
    // 1. Expired sessions.
    db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();

    // 2. Spent / stale SSO hand-off tokens.
    db.prepare(`DELETE FROM sso_tokens WHERE used = 1 OR expires_at < datetime('now', '-1 day')`).run();

    // 3. Demo sandboxes older than 7 days ("Explore the demo home" creates a
    //    fresh household per visitor — reclaim them so the DB doesn't grow forever).
    const stale = db.prepare(`
      SELECT DISTINCT h.id FROM households h
      JOIN users u ON u.household_id = h.id
      WHERE u.email LIKE 'demo+%@harthome.demo'
        AND h.created_at < datetime('now', '-7 days')
    `).all();
    for (const row of stale) deleteHousehold(row.id);
    if (stale.length) console.log(`[sweeps] removed ${stale.length} stale demo household(s)`);
  } catch (err) {
    console.error('[sweeps] failed:', err.message);
  }
}

module.exports = { runSweeps, deleteHousehold, HOUSEHOLD_TABLES };
