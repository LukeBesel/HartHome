const { test } = require('node:test');
const assert = require('node:assert');

// Run against an isolated temp DB with demo seeding on.
process.env.SEED_DEMO_DATA = 'true';
process.env.DATABASE_PATH = require('path').join(require('os').tmpdir(), `harthome-test-${Date.now()}.db`);
process.env.NODE_ENV = 'test';

const app = require('../src/index');

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function api(server, path, opts = {}) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('health check responds ok', async () => {
  const server = await listen();
  try {
    const { status, body } = await api(server, '/api/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
  } finally { server.close(); }
});

test('protected routes reject anonymous access', async () => {
  const server = await listen();
  try {
    const { status } = await api(server, '/api/chores');
    assert.equal(status, 401);
  } finally { server.close(); }
});

test('signup → auth flow issues a working token', async () => {
  const server = await listen();
  try {
    const signup = await api(server, '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Test Home', displayName: 'Tester', email: `t${Date.now()}@x.com`, password: 'password123' }),
    });
    assert.equal(signup.status, 201);
    assert.ok(signup.body.token);

    const auth = { Authorization: `Bearer ${signup.body.token}` };
    const me = await api(server, '/api/auth/me', { headers: auth });
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'owner');

    // Create a chore, then complete it and confirm points are awarded.
    const create = await api(server, '/api/chores', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test chore', points: 10, assignee_id: me.body.id }),
    });
    assert.equal(create.status, 201);
    const done = await api(server, `/api/chores/${create.body.id}/complete`, { method: 'POST', headers: auth });
    assert.equal(done.status, 200);
    assert.equal(done.body.member.points, 10);
  } finally { server.close(); }
});

test('invite flow: a partner can join the same household + PINs gate switching', async () => {
  const server = await listen();
  try {
    const owner = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Invite Home', displayName: 'Owner', email: `o${Date.now()}@x.com`, password: 'password123' }),
    });
    const oAuth = { Authorization: `Bearer ${owner.body.token}` };

    const hh = await api(server, '/api/members/household/info', { headers: oAuth });
    const code = hh.body.invite_code;
    assert.ok(code);

    // Public lookup resolves the household name.
    const look = await api(server, `/api/auth/invite/${code}`);
    assert.equal(look.body.household_name, 'Invite Home');

    // Partner joins with the code → same household.
    const join = await api(server, '/api/auth/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: code, displayName: 'Partner', email: `p${Date.now()}@x.com`, password: 'password123' }),
    });
    assert.equal(join.status, 201);
    const me = await api(server, '/api/auth/me', { headers: oAuth });
    const partnerMe = await api(server, '/api/auth/me', { headers: { Authorization: `Bearer ${join.body.token}` } });
    assert.equal(me.body.household_id, partnerMe.body.household_id);

    // Add a child profile, PIN-protect it, and verify switching is gated.
    const kid = await api(server, '/api/members', {
      method: 'POST', headers: { ...oAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Kid', role: 'child' }),
    });
    await api(server, '/api/auth/set-pin', {
      method: 'POST', headers: { ...oAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: kid.body.id, pin: '1234' }),
    });
    const bad = await api(server, '/api/auth/switch-profile', {
      method: 'POST', headers: { ...oAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: kid.body.id, pin: '0000' }),
    });
    assert.equal(bad.status, 403);
    const good = await api(server, '/api/auth/switch-profile', {
      method: 'POST', headers: { ...oAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: kid.body.id, pin: '1234' }),
    });
    assert.equal(good.status, 200);
    assert.ok(good.body.token);
  } finally { server.close(); }
});

test('per-user preferences round-trip and persist', async () => {
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Prefs Home', displayName: 'P', email: `pr${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}` };
    const empty = await api(server, '/api/members/me/prefs', { headers: auth });
    assert.deepEqual(empty.body, {});
    const prefs = { theme: { accent: '#ff8800', mode: 'dark', density: 'compact' }, dashboard: { widgets: [{ id: 'today', enabled: true }] } };
    await api(server, '/api/members/me/prefs', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) });
    const got = await api(server, '/api/members/me/prefs', { headers: auth });
    assert.equal(got.body.theme.accent, '#ff8800');
    assert.equal(got.body.dashboard.widgets[0].id, 'today');
  } finally { server.close(); }
});

test('children are blocked from money APIs server-side when finances are locked', async () => {
  const server = await listen();
  try {
    const owner = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Lock Home', displayName: 'P', email: `lk${Date.now()}@x.com`, password: 'password123' }),
    });
    const pAuth = { Authorization: `Bearer ${owner.body.token}` };
    const kidEmail = `kid${Date.now()}@x.com`;
    await api(server, '/api/members', {
      method: 'POST', headers: { ...pAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Kid', role: 'child', email: kidEmail, password: 'password123' }),
    });
    const kid = await api(server, '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: kidEmail, password: 'password123' }),
    });
    const kAuth = { Authorization: `Bearer ${kid.body.token}` };

    // Before the lock: kid can read bills.
    const before = await api(server, '/api/bills', { headers: kAuth });
    assert.equal(before.status, 200);

    // Parent locks finances.
    await api(server, '/api/members/household/finance-pin', {
      method: 'POST', headers: { ...pAuth, 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '4321' }),
    });

    // Kid is now blocked from every money API…
    for (const p of ['/api/bills', '/api/finance/summary', '/api/utilities']) {
      const r = await api(server, p, { headers: kAuth });
      assert.equal(r.status, 403, `${p} should be 403 for a locked child`);
      assert.equal(r.body.code, 'FINANCE_LOCKED');
    }
    // …the dashboard hides money…
    const dash = await api(server, '/api/dashboard', { headers: kAuth });
    assert.equal(dash.body.financeHidden, true);
    assert.equal(dash.body.finance.netWorth, 0);
    assert.deepEqual(dash.body.billsDue, []);
    // …but parents still pass.
    const pd = await api(server, '/api/bills', { headers: pAuth });
    assert.equal(pd.status, 200);
  } finally { server.close(); }
});

test('create endpoints reject missing required fields with a friendly 400', async () => {
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Val Home', displayName: 'V', email: `v${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}`, 'Content-Type': 'application/json' };
    const cases = [
      ['/api/chores', {}],
      ['/api/events', { title: 'No start' }],
      ['/api/bills', {}],
      ['/api/lists/items', { name: 'orphan item' }], // missing list_id
    ];
    for (const [p, body] of cases) {
      const r = await api(server, p, { method: 'POST', headers: auth, body: JSON.stringify(body) });
      assert.equal(r.status, 400, `${p} should 400`);
      assert.equal(r.body.code, 'MISSING_FIELD');
    }
    // Invalid enum value maps to a clean 400 (not a 500).
    const bad = await api(server, '/api/bills', { method: 'POST', headers: auth, body: JSON.stringify({ name: 'X', frequency: 'fortnightly' }) });
    assert.equal(bad.status, 400);
  } finally { server.close(); }
});

test('sweeps reclaim stale demo households', async () => {
  const server = await listen();
  try {
    const db = require('../src/db');
    const { runSweeps } = require('../src/sweeps');
    // Create a demo sandbox, then age it a week.
    const demo = await api(server, '/api/auth/demo', { method: 'POST' });
    const me = await api(server, '/api/auth/me', { headers: { Authorization: `Bearer ${demo.body.token}` } });
    const hid = me.body.household_id;
    db.prepare(`UPDATE households SET created_at = datetime('now', '-8 days') WHERE id = ?`).run(hid);
    runSweeps();
    assert.equal(db.prepare('SELECT COUNT(*) c FROM households WHERE id = ?').get(hid).c, 0, 'household removed');
    assert.equal(db.prepare('SELECT COUNT(*) c FROM users WHERE household_id = ?').get(hid).c, 0, 'users cascaded');
    assert.equal(db.prepare('SELECT COUNT(*) c FROM chores WHERE household_id = ?').get(hid).c, 0, 'domain rows removed');
  } finally { server.close(); }
});

test('financial passcode locks and never leaks the hash', async () => {
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Money Home', displayName: 'P', email: `m${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}` };

    const info0 = await api(server, '/api/members/household/info', { headers: auth });
    assert.equal(info0.body.finance_locked, false);
    assert.equal(info0.body.finance_pin, undefined); // never exposed

    const set = await api(server, '/api/members/household/finance-pin', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '2580' }),
    });
    assert.equal(set.body.finance_locked, true);

    const bad = await api(server, '/api/members/household/finance-unlock', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }),
    });
    assert.equal(bad.status, 403);
    const ok = await api(server, '/api/members/household/finance-unlock', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '2580' }),
    });
    assert.equal(ok.status, 200);

    const me = await api(server, '/api/auth/me', { headers: auth });
    assert.equal(me.body.household.finance_pin, undefined);
    assert.equal(me.body.household.finance_locked, true);
  } finally { server.close(); }
});

test('calendar feed subscription imports ICS events', async () => {
  const http = require('node:http');
  const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Imported Practice\r\nDTSTART:20260701T160000Z\r\nDTEND:20260701T170000Z\r\nLOCATION:Field 3\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const icsServer = await new Promise((resolve) => {
    const srv = http.createServer((_q, s) => { s.setHeader('content-type', 'text/calendar'); s.end(ICS); }).listen(0, () => resolve(srv));
  });
  const icsUrl = `http://127.0.0.1:${icsServer.address().port}/cal.ics`;
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Feed Home', displayName: 'F', email: `f${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}` };
    const add = await api(server, '/api/calendar-feeds', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test', url: icsUrl }),
    });
    assert.equal(add.status, 201);
    assert.equal(add.body.ok, true);
    assert.equal(add.body.count, 1);
    const events = await api(server, '/api/events', { headers: auth });
    const imported = events.body.filter((e) => e.feed_id);
    assert.equal(imported.length, 1);
    assert.equal(imported[0].title, 'Imported Practice');
  } finally { server.close(); icsServer.close(); }
});

test('health module logs metrics and enforces privacy', async () => {
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Well Home', displayName: 'Parent', email: `w${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}` };

    // Log water twice + weight; summary aggregates.
    for (let i = 0; i < 2; i++) await api(server, '/api/health/logs', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'water', value: 1 }) });
    await api(server, '/api/health/logs', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'weight', value: 170 }) });
    const sum = await api(server, '/api/health/summary', { headers: auth });
    assert.equal(sum.body.today.water, 2);
    assert.equal(sum.body.weight.value, 170);

    // Add an adult member who keeps health private → owner can't view.
    const adult = await api(server, '/api/members', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: 'Partner', role: 'parent' }) });
    const blocked = await api(server, `/api/health/summary?member_id=${adult.body.id}`, { headers: auth });
    assert.equal(blocked.status, 403);

    // A child is manageable by a parent → viewable.
    const kid = await api(server, '/api/members', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: 'Kid', role: 'child' }) });
    const kidView = await api(server, `/api/health/summary?member_id=${kid.body.id}`, { headers: auth });
    assert.equal(kidView.status, 200);
  } finally { server.close(); }
});

test('rotating chore advances the assignee on completion', async () => {
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Rota Home', displayName: 'A', email: `r${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}` };
    const me = await api(server, '/api/auth/me', { headers: auth });
    const kid = await api(server, '/api/members', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: 'Kid', role: 'child' }),
    });
    const a1 = me.body.id, a2 = kid.body.id;
    const chore = await api(server, '/api/chores', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Dishes', recurrence: 'weekly', assignee_id: a1, rotation: JSON.stringify([a1, a2]) }),
    });
    const done = await api(server, `/api/chores/${chore.body.id}/complete`, { method: 'POST', headers: auth });
    assert.equal(done.status, 200);
    assert.equal(done.body.chore.assignee_id, a2, 'assignee rotated to the next member');
  } finally { server.close(); }
});

test('SSO hand-off issues a one-time token that verifies identity', async () => {
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'SSO Home', displayName: 'Sam', email: `s${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}` };
    // SSO hand-off is a Hart+ feature — upgrade (demo mode) first.
    await api(server, '/api/billing/upgrade', { method: 'POST', headers: auth });
    const handoff = await api(server, '/api/sso/handoff', { method: 'POST', headers: auth });
    assert.ok(handoff.body.token);

    const v1 = await api(server, `/api/sso/verify?token=${handoff.body.token}`);
    assert.equal(v1.status, 200);
    assert.equal(v1.body.user.display_name, 'Sam');
    assert.equal(v1.body.household.name, 'SSO Home');

    // Verify also issues a long-lived link token for the two-way bridge.
    assert.ok(v1.body.link_token);
    const ctx = await api(server, '/api/integrations/context', { headers: { 'X-HartLink': v1.body.link_token } });
    assert.equal(ctx.status, 200);
    assert.equal(ctx.body.household.name, 'SSO Home');
    assert.ok(Array.isArray(ctx.body.members));
    const badLink = await api(server, '/api/integrations/context', { headers: { 'X-HartLink': 'nope' } });
    assert.equal(badLink.status, 401);

    // One-time use: a second verify must fail.
    const v2 = await api(server, `/api/sso/verify?token=${handoff.body.token}`);
    assert.equal(v2.status, 401);
    const v3 = await api(server, '/api/sso/verify?token=garbage');
    assert.equal(v3.status, 401);
  } finally { server.close(); }
});

test('auth config reports google off and the route 503s when unconfigured', async () => {
  const server = await listen();
  try {
    const cfg = await api(server, '/api/auth/config');
    assert.equal(cfg.status, 200);
    assert.equal(cfg.body.google, false); // no GOOGLE_CLIENT_ID in tests
    const start = await api(server, '/api/auth/google', { redirect: 'manual' });
    assert.equal(start.status, 503);
  } finally { server.close(); }
});

test('demo sandbox spins up a fresh, fully-populated, isolated household', async () => {
  const server = await listen();
  try {
    const a = await api(server, '/api/auth/demo', { method: 'POST' });
    assert.equal(a.status, 201);
    assert.ok(a.body.token);
    assert.equal(a.body.demo, true);

    const auth = { Authorization: `Bearer ${a.body.token}` };
    const dash = await api(server, '/api/dashboard', { headers: auth });
    assert.equal(dash.status, 200);
    assert.ok(dash.body.members.length >= 4, 'demo has a family');
    assert.ok(dash.body.choresDue.length > 0, 'demo has chores');

    const fin = await api(server, '/api/finance/summary', { headers: auth });
    assert.ok(fin.body.trend.length >= 2, 'demo has multi-month financial history');

    // A second demo call must be a separate household (no shared data).
    const b = await api(server, '/api/auth/demo', { method: 'POST' });
    const meA = await api(server, '/api/auth/me', { headers: auth });
    const meB = await api(server, '/api/auth/me', { headers: { Authorization: `Bearer ${b.body.token}` } });
    assert.notEqual(meA.body.household_id, meB.body.household_id);
  } finally { server.close(); }
});


test('password reset: forgot issues a token, reset changes password and revokes sessions', async () => {
  const server = await listen();
  try {
    const db = require('../src/db');
    const email = `rst${Date.now()}@x.com`;
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Reset Home', displayName: 'R', email, password: 'password123' }),
    });
    // Ask for a reset (always ok, even for unknown emails).
    const unknown = await api(server, '/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody@x.com' }) });
    assert.equal(unknown.status, 200);
    await api(server, '/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    await new Promise(r => setTimeout(r, 50)); // token insert happens after the response
    const row = db.prepare(`SELECT pr.token FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE u.email = ? ORDER BY pr.created_at DESC`).get(email);
    assert.ok(row?.token, 'reset token created');

    const reset = await api(server, '/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: row.token, password: 'newpassword1' }) });
    assert.equal(reset.status, 200);
    // Old session revoked; old password dead; new password works.
    const old = await api(server, '/api/auth/me', { headers: { Authorization: `Bearer ${s.body.token}` } });
    assert.equal(old.status, 401);
    const bad = await api(server, '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'password123' }) });
    assert.equal(bad.status, 401);
    const good = await api(server, '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'newpassword1' }) });
    assert.equal(good.status, 200);
    // Token is single-use.
    const again = await api(server, '/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: row.token, password: 'anotherpass1' }) });
    assert.equal(again.status, 400);
  } finally { server.close(); }
});

test('outbound iCal feed serves events with RRULE and rejects bad tokens', async () => {
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Ical Home', displayName: 'I', email: `ic${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}`, 'Content-Type': 'application/json' };
    await api(server, '/api/events', { method: 'POST', headers: auth, body: JSON.stringify({ title: 'Weekly swim', start_at: new Date().toISOString(), recurrence: 'weekly', location: 'Pool' }) });
    const feed = await api(server, '/api/ical/feed', { headers: auth });
    assert.ok(feed.body.path.startsWith('/api/ical/'));

    const { port } = server.address();
    const ics = await fetch(`http://127.0.0.1:${port}${feed.body.path}`);
    assert.equal(ics.status, 200);
    assert.match(ics.headers.get('content-type'), /text\/calendar/);
    const text = await ics.text();
    assert.ok(text.includes('BEGIN:VCALENDAR'));
    assert.ok(text.includes('SUMMARY:Weekly swim'));
    assert.ok(text.includes('RRULE:FREQ=WEEKLY'));
    assert.ok(text.includes('LOCATION:Pool'));

    const bad = await fetch(`http://127.0.0.1:${port}/api/ical/not-a-token.ics`);
    assert.equal(bad.status, 404);
  } finally { server.close(); }
});

test('uploads store files on disk and serve them back', async () => {
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Up Home', displayName: 'U', email: `up${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}`, 'Content-Type': 'application/json' };
    const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const up = await api(server, '/api/upload', { method: 'POST', headers: auth, body: JSON.stringify({ name: 'dot.png', data: png1x1 }) });
    assert.equal(up.status, 201);
    assert.ok(up.body.url.startsWith('/uploads/'));

    const { port } = server.address();
    const file = await fetch(`http://127.0.0.1:${port}${up.body.url}`);
    assert.equal(file.status, 200);

    const bad = await api(server, '/api/upload', { method: 'POST', headers: auth, body: JSON.stringify({ name: 'x', data: 'not-a-data-url' }) });
    assert.equal(bad.status, 400);
  } finally { server.close(); }
});


test('Hart+ plan gates HartCare SSO and upgrades in demo mode', async () => {
  const server = await listen();
  try {
    const s = await api(server, '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName: 'Plan Home', displayName: 'P', email: `pl${Date.now()}@x.com`, password: 'password123' }),
    });
    const auth = { Authorization: `Bearer ${s.body.token}`, 'Content-Type': 'application/json' };

    // Fresh households are Free; SSO hand-off (paid) is blocked with a clean code.
    const b0 = await api(server, '/api/billing', { headers: auth });
    assert.equal(b0.body.plan, 'free');
    assert.ok(b0.body.plans.plus.features.length > 0);
    const blocked = await api(server, '/api/sso/handoff', { method: 'POST', headers: auth });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'UPGRADE_REQUIRED');

    // Demo upgrade applies instantly; SSO now works; plan visible on /me.
    const up = await api(server, '/api/billing/upgrade', { method: 'POST', headers: auth });
    assert.equal(up.body.plan, 'plus');
    assert.equal(up.body.demo, true);
    const handoff = await api(server, '/api/sso/handoff', { method: 'POST', headers: auth });
    assert.equal(handoff.status, 200);
    assert.ok(handoff.body.token);
    const me = await api(server, '/api/auth/me', { headers: auth });
    assert.equal(me.body.household.plan, 'plus');

    // Downgrade re-locks the paid feature.
    await api(server, '/api/billing/downgrade', { method: 'POST', headers: auth });
    const relocked = await api(server, '/api/sso/handoff', { method: 'POST', headers: auth });
    assert.equal(relocked.status, 403);

    // Children can't change the plan.
    const kidEmail = `pk${Date.now()}@x.com`;
    await api(server, '/api/members', { method: 'POST', headers: auth, body: JSON.stringify({ display_name: 'Kid', role: 'child', email: kidEmail, password: 'password123' }) });
    const kid = await api(server, '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: kidEmail, password: 'password123' }) });
    const kidUp = await api(server, '/api/billing/upgrade', { method: 'POST', headers: { Authorization: `Bearer ${kid.body.token}` } });
    assert.equal(kidUp.status, 403);
  } finally { server.close(); }
});

test('demo household is seeded and tenant-isolated', async () => {
  const server = await listen();
  try {
    const login = await api(server, '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@harthome.demo', password: 'Demo123!' }),
    });
    assert.equal(login.status, 200);
    const auth = { Authorization: `Bearer ${login.body.token}` };
    const dash = await api(server, '/api/dashboard', { headers: auth });
    assert.equal(dash.status, 200);
    assert.ok(dash.body.members.length >= 4);
    assert.ok(dash.body.choresDue.length > 0);
  } finally { server.close(); }
});
