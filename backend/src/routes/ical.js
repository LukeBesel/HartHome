const express = require('express');
const crypto = require('crypto');
const db = require('../db');

// ─── Outbound iCal feed ───────────────────────────────────────────────────────
// Publishes the household calendar as a standards-compliant ICS feed that
// Google / Apple / Outlook can subscribe to ("From URL" / "Subscribe"). The URL
// carries an unguessable per-household token; recurring events are expressed
// with RRULE so subscribers expand them natively.

const RRULE = {
  daily: 'FREQ=DAILY',
  weekly: 'FREQ=WEEKLY',
  biweekly: 'FREQ=WEEKLY;INTERVAL=2',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
};

const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const dt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateOnly = (iso) => new Date(iso).toISOString().slice(0, 10).replace(/-/g, '');

// Authenticated: fetch (or mint) the household's feed URL.
function getFeedInfo(req, res) {
  let row = db.prepare('SELECT ics_token FROM households WHERE id = ?').get(req.householdId);
  if (!row?.ics_token) {
    const token = crypto.randomBytes(20).toString('hex');
    db.prepare('UPDATE households SET ics_token = ? WHERE id = ?').run(token, req.householdId);
    row = { ics_token: token };
  }
  res.json({ path: `/api/ical/${row.ics_token}.ics` });
}

// Authenticated: rotate the token (invalidates the old URL).
function regenerateFeed(req, res) {
  const token = crypto.randomBytes(20).toString('hex');
  db.prepare('UPDATE households SET ics_token = ? WHERE id = ?').run(token, req.householdId);
  res.json({ path: `/api/ical/${token}.ics` });
}

// Public: the feed itself, token-authenticated.
function serveFeed(req, res, next) {
  // /api/ical/feed belongs to the authenticated info router registered later.
  if (req.params.token === 'feed') return next();
  const token = String(req.params.token || '').replace(/\.ics$/, '');
  const hh = token && db.prepare('SELECT id, name FROM households WHERE ics_token = ?').get(token);
  if (!hh) return res.status(404).send('Not found');

  // Household-authored events only — imported feed events (feed_id) are skipped
  // so subscribers don't get echoes of their own calendars.
  const events = db.prepare(
    `SELECT * FROM events WHERE household_id = ? AND feed_id IS NULL
     AND start_at > datetime('now', '-60 days') ORDER BY start_at LIMIT 1000`
  ).all(hh.id);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HartHome//Family Calendar//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(hh.name)} (HartHome)`,
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@harthome`);
    lines.push(`DTSTAMP:${dt(e.updated_at || e.created_at || e.start_at)}`);
    if (e.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.start_at)}`);
      if (e.end_at) lines.push(`DTEND;VALUE=DATE:${dateOnly(e.end_at)}`);
    } else {
      lines.push(`DTSTART:${dt(e.start_at)}`);
      if (e.end_at) lines.push(`DTEND:${dt(e.end_at)}`);
    }
    if (RRULE[e.recurrence]) lines.push(`RRULE:${RRULE[e.recurrence]}`);
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');

  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.send(lines.join('\r\n'));
}

const router = express.Router(); // mounted behind requireAuth
router.get('/feed', getFeedInfo);
router.post('/feed/regenerate', regenerateFeed);

module.exports = { router, serveFeed };
