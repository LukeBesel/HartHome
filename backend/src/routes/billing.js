const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { logActivity } = require('../helpers');

// ─── Plans & billing ──────────────────────────────────────────────────────────
// Two tiers keep it simple:
//   free  — every core HartHome module, plus a HartCare teaser (preview hub +
//           plain launch link) so families can see what they'd get.
//   plus  — "Hart+": full HartCare integration (one-tap signed-in launch, live
//           wellness on the dashboard, two-way family/calendar bridge).
// Billing runs in DEMO mode until real Stripe keys exist: upgrades apply
// instantly and are clearly labeled. The plan lives on the household so the
// whole family shares it.

const PLANS = {
  free: {
    id: 'free', label: 'Free', price: 0,
    features: ['All core modules (calendar, chores, lists, meals, money, health…)', 'Wall display & kiosk mode', 'Unlimited family members', 'HartCare preview'],
  },
  plus: {
    id: 'plus', label: 'Hart+', price: 4.99,
    features: ['Everything in Free', 'Open HartCare signed-in with one tap (SSO)', 'Live HartCare wellness on your dashboard', 'Two-way family & calendar bridge with HartCare', 'Priority support'],
  },
};

function getPlan(householdId) {
  const row = db.prepare('SELECT plan FROM households WHERE id = ?').get(householdId);
  return row?.plan === 'plus' ? 'plus' : 'free';
}

// Gate for Plus-only endpoints. Returns a structured 403 the client turns into
// an upgrade prompt.
function requirePlus(req, res, next) {
  if (getPlan(req.householdId) === 'plus') return next();
  res.status(403).json({ error: 'This feature is part of Hart+.', code: 'UPGRADE_REQUIRED' });
}

const router = express.Router(); // mounted behind requireAuth

router.get('/', (req, res) => {
  const plan = getPlan(req.householdId);
  res.json({ plan, demo: true, plans: PLANS }); // demo:true until Stripe keys are wired
});

// Parents manage the household plan. In demo mode the upgrade applies
// instantly — swap this for a Stripe Checkout session when keys are added.
router.post('/upgrade', requireRole('parent'), (req, res) => {
  db.prepare(`UPDATE households SET plan = 'plus' WHERE id = ?`).run(req.householdId);
  logActivity(req.householdId, req.user, 'billing', 'upgraded the household to Hart+ 🎉');
  res.json({ plan: 'plus', demo: true });
});

router.post('/downgrade', requireRole('parent'), (req, res) => {
  db.prepare(`UPDATE households SET plan = 'free' WHERE id = ?`).run(req.householdId);
  logActivity(req.householdId, req.user, 'billing', 'moved the household to the Free plan');
  res.json({ plan: 'free', demo: true });
});

module.exports = { router, requirePlus, getPlan, PLANS };
