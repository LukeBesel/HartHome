const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { emitChange } = require('../bus');

const router = express.Router();

// ─── Minimal ICS (VEVENT) parser ──────────────────────────────────────────────
function parseICS(text) {
  const out = [];
  const lines = text.replace(/\r\n[ \t]/g, '').split(/\r?\n/); // unfold
  let cur = null;
  const toISO = (v) => {
    const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    if (!h) return `${y}-${mo}-${d}T09:00:00.000Z`;
    return z
      ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0))).toISOString()
      : new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0)).toISOString();
  };
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') { if (cur && cur.start_at && cur.title) out.push(cur); cur = null; }
    else if (cur) {
      const idx = line.indexOf(':'); if (idx < 0) continue;
      const key = line.slice(0, idx).split(';')[0]; const val = line.slice(idx + 1).trim();
      if (key === 'SUMMARY') cur.title = val.replace(/\\,/g, ',').replace(/\\n/gi, ' ');
      else if (key === 'LOCATION') cur.location = val.replace(/\\,/g, ',');
      else if (key === 'DTSTART') { cur.start_at = toISO(val); cur.all_day = /^\d{8}$/.test(val) ? 1 : 0; }
      else if (key === 'DTEND') cur.end_at = toISO(val);
    }
  }
  return out;
}

// Fetch + import a feed, replacing its previously-imported events. Keeps events
// within a sane window (-60 days … +400 days) so a huge feed can't flood.
async function syncFeed(feed) {
  let text;
  try {
    const res = await fetch(feed.url, { headers: { Accept: 'text/calendar,*/*' }, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    db.prepare('UPDATE calendar_feeds SET last_error = ?, last_synced = datetime(\'now\') WHERE id = ?').run(String(e.message).slice(0, 200), feed.id);
    return { ok: false, error: e.message };
  }
  const now = Date.now();
  const events = parseICS(text).filter(e => {
    const t = Date.parse(e.start_at);
    return !isNaN(t) && t > now - 60 * 864e5 && t < now + 400 * 864e5;
  }).slice(0, 800);

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM events WHERE household_id = ? AND feed_id = ?').run(feed.household_id, feed.id);
    const ins = db.prepare(`INSERT INTO events (id, household_id, title, description, location, start_at, end_at, all_day, member_id, color, category, recurrence, feed_id)
                            VALUES (?,?,?,?,?,?,?,?,?,?,?, 'none', ?)`);
    for (const e of events) {
      ins.run(uuid(), feed.household_id, e.title.slice(0, 200), '', e.location || '', e.start_at, e.end_at || null, e.all_day ? 1 : 0, feed.member_id || null, feed.color, 'general', feed.id);
    }
  });
  tx();
  db.prepare('UPDATE calendar_feeds SET last_synced = datetime(\'now\'), last_count = ?, last_error = \'\' WHERE id = ?').run(events.length, feed.id);
  emitChange(feed.household_id, 'events');
  return { ok: true, count: events.length };
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM calendar_feeds WHERE household_id = ? ORDER BY created_at').all(req.householdId));
});

router.post('/', async (req, res) => {
  const { name, url, color, member_id } = req.body;
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'A valid calendar URL is required.' });
  const id = uuid();
  db.prepare('INSERT INTO calendar_feeds (id, household_id, member_id, name, url, color) VALUES (?,?,?,?,?,?)')
    .run(id, req.householdId, member_id || null, name || 'Calendar', url.trim(), color || '#6366f1');
  const feed = db.prepare('SELECT * FROM calendar_feeds WHERE id = ?').get(id);
  const result = await syncFeed(feed);
  res.status(201).json({ feed: db.prepare('SELECT * FROM calendar_feeds WHERE id = ?').get(id), ...result });
});

router.post('/:id/sync', async (req, res) => {
  const feed = db.prepare('SELECT * FROM calendar_feeds WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!feed) return res.status(404).json({ error: 'Not found' });
  const result = await syncFeed(feed);
  res.json({ feed: db.prepare('SELECT * FROM calendar_feeds WHERE id = ?').get(feed.id), ...result });
});

router.delete('/:id', (req, res) => {
  const feed = db.prepare('SELECT * FROM calendar_feeds WHERE id = ? AND household_id = ?').get(req.params.id, req.householdId);
  if (!feed) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM events WHERE feed_id = ?').run(feed.id);
  db.prepare('DELETE FROM calendar_feeds WHERE id = ?').run(feed.id);
  emitChange(req.householdId, 'events');
  res.json({ ok: true });
});

// Periodic refresh of every feed (called on an interval from index.js).
async function syncAll() {
  const feeds = db.prepare('SELECT * FROM calendar_feeds').all();
  for (const f of feeds) { try { await syncFeed(f); } catch { /* ignore */ } }
}

module.exports = { router, syncAll };
