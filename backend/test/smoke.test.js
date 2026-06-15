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
