const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { config } = require('./config');

const DB_PATH = config.databasePath;
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ─────────────────────────────────────────────────────────────────
// One SQLite file holds every household. Every domain row carries a
// household_id so all queries are naturally tenant-scoped (see crud.js).

db.exec(`
  CREATE TABLE IF NOT EXISTS households (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    timezone TEXT DEFAULT 'America/New_York',
    accent TEXT DEFAULT 'midnight',
    address TEXT DEFAULT '',
    invite_code TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    password_hash TEXT,
    display_name TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK(role IN ('owner','parent','member','child')),
    avatar_color TEXT DEFAULT '#6366f1',
    points INTEGER DEFAULT 0,
    birthday TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    location TEXT DEFAULT '',
    start_at TEXT NOT NULL,
    end_at TEXT,
    all_day INTEGER DEFAULT 0,
    member_id TEXT,
    color TEXT DEFAULT '#6366f1',
    category TEXT DEFAULT 'general',
    recurrence TEXT DEFAULT 'none',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chores (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    assignee_id TEXT,
    points INTEGER DEFAULT 5,
    recurrence TEXT DEFAULT 'once',
    day_of_week INTEGER,
    due_date TEXT,
    status TEXT DEFAULT 'todo' CHECK(status IN ('todo','done')),
    last_completed_at TEXT,
    icon TEXT DEFAULT 'CheckSquare',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chore_completions (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    chore_id TEXT,
    chore_title TEXT DEFAULT '',
    member_id TEXT,
    points INTEGER DEFAULT 0,
    completed_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'family',
    target REAL DEFAULT 100,
    current REAL DEFAULT 0,
    unit TEXT DEFAULT '%',
    member_id TEXT,
    due_date TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','done','archived')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goal_milestones (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    cost INTEGER DEFAULT 50,
    icon TEXT DEFAULT 'Gift',
    stock INTEGER DEFAULT -1,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reward_redemptions (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    reward_id TEXT,
    reward_title TEXT DEFAULT '',
    member_id TEXT,
    cost INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','fulfilled','denied')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'custom' CHECK(type IN ('grocery','todo','custom','packing','wishlist')),
    icon TEXT DEFAULT 'ListChecks',
    color TEXT DEFAULT '#6366f1',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS list_items (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    list_id TEXT NOT NULL,
    name TEXT NOT NULL,
    qty TEXT DEFAULT '',
    category TEXT DEFAULT '',
    note TEXT DEFAULT '',
    assignee_id TEXT,
    done INTEGER DEFAULT 0,
    sort INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    ingredients TEXT DEFAULT '[]',
    instructions TEXT DEFAULT '',
    prep_minutes INTEGER DEFAULT 0,
    servings INTEGER DEFAULT 2,
    tags TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    date TEXT NOT NULL,
    meal_type TEXT DEFAULT 'dinner' CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    recipe_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL DEFAULT 0,
    category TEXT DEFAULT 'utilities',
    frequency TEXT DEFAULT 'monthly' CHECK(frequency IN ('weekly','monthly','quarterly','yearly','once')),
    next_due TEXT,
    autopay INTEGER DEFAULT 0,
    account TEXT DEFAULT '',
    member_id TEXT,
    status TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming','paid','overdue')),
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bill_payments (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    bill_id TEXT,
    bill_name TEXT DEFAULT '',
    amount REAL DEFAULT 0,
    paid_at TEXT DEFAULT (datetime('now')),
    note TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'checking' CHECK(type IN ('checking','savings','credit','cash','investment','loan')),
    balance REAL DEFAULT 0,
    institution TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    type TEXT DEFAULT 'expense' CHECK(type IN ('income','expense','transfer')),
    amount REAL DEFAULT 0,
    category TEXT DEFAULT 'general',
    description TEXT DEFAULT '',
    account_id TEXT,
    member_id TEXT,
    date TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    category TEXT NOT NULL,
    monthly_limit REAL DEFAULT 0,
    icon TEXT DEFAULT 'Wallet',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS utilities (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    provider TEXT DEFAULT '',
    type TEXT DEFAULT 'other' CHECK(type IN ('electric','water','gas','internet','trash','phone','streaming','other')),
    account_number TEXT DEFAULT '',
    monthly_estimate REAL DEFAULT 0,
    unit TEXT DEFAULT '',
    contact TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS utility_readings (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    utility_id TEXT NOT NULL,
    reading REAL DEFAULT 0,
    cost REAL DEFAULT 0,
    period TEXT,
    recorded_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'other' CHECK(type IN ('vehicle','appliance','home','electronics','tool','other')),
    make TEXT DEFAULT '',
    model TEXT DEFAULT '',
    year INTEGER,
    identifier TEXT DEFAULT '',
    purchase_date TEXT,
    purchase_price REAL DEFAULT 0,
    current_value REAL DEFAULT 0,
    mileage INTEGER,
    warranty_expires TEXT,
    location TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    icon TEXT DEFAULT 'Car',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS maintenance (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'service' CHECK(type IN ('service','repair','inspection','registration','warranty','other')),
    due_date TEXT,
    due_mileage INTEGER,
    completed_at TEXT,
    cost REAL DEFAULT 0,
    provider TEXT DEFAULT '',
    recurrence_months INTEGER DEFAULT 0,
    recurrence_miles INTEGER DEFAULT 0,
    status TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming','overdue','done')),
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT DEFAULT '',
    category TEXT DEFAULT 'other' CHECK(category IN ('emergency','medical','school','service','family','work','other')),
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    title TEXT DEFAULT '',
    body TEXT DEFAULT '',
    color TEXT DEFAULT '#fef3c7',
    pinned INTEGER DEFAULT 0,
    author_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'other',
    reference TEXT DEFAULT '',
    expires_at TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'wall' CHECK(type IN ('wall','tablet','tv','phone','hub')),
    pairing_code TEXT,
    widgets TEXT DEFAULT '["clock","weather","calendar","chores"]',
    rotate_seconds INTEGER DEFAULT 0,
    last_seen TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    author_id TEXT,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    member_id TEXT,
    member_name TEXT DEFAULT '',
    type TEXT DEFAULT 'general',
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_household ON events(household_id, start_at);
  CREATE INDEX IF NOT EXISTS idx_chores_household ON chores(household_id);
  CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id);
  CREATE INDEX IF NOT EXISTS idx_activity_household ON activity(household_id, created_at);
`);

// ─── Password reset tokens ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    used INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Saved/shareable household themes ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS household_themes (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    theme TEXT DEFAULT '{}',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Photos (family slideshow / wall display) ────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    url TEXT NOT NULL,
    caption TEXT DEFAULT '',
    sort INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Lightweight migrations (additive columns on existing installs) ───────────
const userCols = db.prepare('PRAGMA table_info(users)').all().map(r => r.name);
if (!userCols.includes('pin')) db.exec('ALTER TABLE users ADD COLUMN pin TEXT');
if (!userCols.includes('preferences')) db.exec("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'");

const docCols = db.prepare('PRAGMA table_info(documents)').all().map(r => r.name);
if (!docCols.includes('file_data')) db.exec('ALTER TABLE documents ADD COLUMN file_data TEXT');
if (!docCols.includes('file_name')) db.exec('ALTER TABLE documents ADD COLUMN file_name TEXT');

const choreCols = db.prepare('PRAGMA table_info(chores)').all().map(r => r.name);
if (!choreCols.includes('rotation')) db.exec("ALTER TABLE chores ADD COLUMN rotation TEXT DEFAULT ''");

// External calendar feeds (iCal/ICS subscriptions) — events carry a feed_id so
// a re-sync can cleanly replace just that feed's imported events.
const eventCols = db.prepare('PRAGMA table_info(events)').all().map(r => r.name);
if (!eventCols.includes('feed_id')) db.exec('ALTER TABLE events ADD COLUMN feed_id TEXT');
db.exec(`
  CREATE TABLE IF NOT EXISTS calendar_feeds (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    member_id TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    last_synced TEXT,
    last_count INTEGER DEFAULT 0,
    last_error TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Health privacy: 'private' (only the member), 'parents', or 'household'.
if (!userCols.includes('health_share')) db.exec("ALTER TABLE users ADD COLUMN health_share TEXT DEFAULT 'private'");

// ─── Health & wellness (privacy-sensitive, per-member) ────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS health_logs (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL,
    text TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    logged_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_health_logs_member ON health_logs(member_id, type, logged_at);

  CREATE TABLE IF NOT EXISTS health_goals (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    type TEXT NOT NULL,
    target REAL DEFAULT 0,
    unit TEXT DEFAULT '',
    period TEXT DEFAULT 'day',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const householdCols = db.prepare('PRAGMA table_info(households)').all().map(r => r.name);
if (!householdCols.includes('finance_pin')) db.exec('ALTER TABLE households ADD COLUMN finance_pin TEXT');
if (!householdCols.includes('hartcare_url')) db.exec("ALTER TABLE households ADD COLUMN hartcare_url TEXT DEFAULT ''");
if (!householdCols.includes('ics_token')) db.exec('ALTER TABLE households ADD COLUMN ics_token TEXT');
if (!householdCols.includes('plan')) db.exec("ALTER TABLE households ADD COLUMN plan TEXT DEFAULT 'free'");

// One-time SSO hand-off tokens for opening sister Hart apps (e.g. HartCare)
// already signed-in with the same household.
db.exec(`
  CREATE TABLE IF NOT EXISTS sso_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    household_id TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS integration_links (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    household_id TEXT NOT NULL,
    user_id TEXT,
    app TEXT DEFAULT 'hartcare',
    last_used TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;

// Seed runs after export so the seed module can `require('./db')` cleanly.
if (config.seedDemoData) {
  try {
    require('./seed')(db);
  } catch (err) {
    console.error('[seed] failed:', err.message);
  }
}
