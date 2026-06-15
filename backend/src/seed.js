const { v4: uuid } = require('uuid');
const crypto = require('crypto');

function hash(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
const days = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const dt = (n, h = 9) => { const d = new Date(Date.now() + n * 864e5); d.setHours(h, 0, 0, 0); return d.toISOString(); };

// Seeds a demo household once. Safe to call on every boot — it no-ops if the
// demo owner already exists.
module.exports = function seed(db) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get('owner@harthome.demo');
  if (exists) return;

  console.log('  ↳ seeding demo household "The Hart Family"…');
  const hid = uuid();
  db.prepare('INSERT INTO households (id, name, address, invite_code) VALUES (?,?,?,?)')
    .run(hid, 'The Hart Family', '14 Maple Grove Lane', 'HART01');

  const members = [
    { name: 'Jordan Hart', email: 'owner@harthome.demo', role: 'owner',  color: '#6366f1', pts: 0,   bday: '1986-09-21' },
    { name: 'Riley Hart',  email: 'riley@harthome.demo', role: 'parent', color: '#ec4899', pts: 0,   bday: '1988-03-12' },
    { name: 'Ava Hart',    email: null,                  role: 'child',  color: '#14b8a6', pts: 145, bday: '2014-06-18' },
    { name: 'Leo Hart',    email: null,                  role: 'child',  color: '#f59e0b', pts: 90,  bday: '2017-11-30' },
  ];
  const ids = {};
  for (const m of members) {
    const id = uuid(); ids[m.name.split(' ')[0]] = id;
    db.prepare(`INSERT INTO users (id, household_id, email, password_hash, display_name, role, avatar_color, points, birthday)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, hid, m.email, m.email ? hash('Demo123!') : null, m.name, m.role, m.color, m.pts, m.bday);
  }
  const { Jordan, Riley, Ava, Leo } = ids;

  const ins = (table, cols, rows) => {
    const stmt = db.prepare(`INSERT INTO ${table} (id, household_id, ${cols.join(',')}) VALUES (?, ?, ${cols.map(() => '?').join(',')})`);
    for (const r of rows) stmt.run(uuid(), hid, ...cols.map(c => r[c] ?? null));
  };

  // ── Calendar ──
  ins('events', ['title', 'start_at', 'end_at', 'member_id', 'color', 'category', 'all_day'], [
    { title: 'Soccer practice', start_at: dt(0, 16), end_at: dt(0, 17), member_id: Ava, color: '#14b8a6', category: 'sports' },
    { title: 'Family movie night', start_at: dt(0, 19), member_id: null, color: '#6366f1', category: 'family' },
    { title: 'Dentist — Leo', start_at: dt(1, 10), member_id: Leo, color: '#f59e0b', category: 'medical' },
    { title: 'Riley — work trip', start_at: dt(2, 8), end_at: dt(3, 18), member_id: Riley, color: '#ec4899', category: 'work', all_day: 1 },
    { title: 'Grocery run', start_at: dt(3, 11), member_id: Jordan, color: '#10b981', category: 'errand' },
    { title: 'Ava piano recital', start_at: dt(5, 18), member_id: Ava, color: '#14b8a6', category: 'school' },
    { title: 'Car service appt', start_at: dt(6, 9), member_id: Jordan, color: '#6366f1', category: 'errand' },
  ]);

  // ── Chores ──
  ins('chores', ['title', 'assignee_id', 'points', 'recurrence', 'due_date', 'icon'], [
    { title: 'Take out trash', assignee_id: Leo, points: 5, recurrence: 'weekly', due_date: days(1), icon: 'Trash2' },
    { title: 'Load the dishwasher', assignee_id: Ava, points: 5, recurrence: 'daily', due_date: days(0), icon: 'Utensils' },
    { title: 'Make your bed', assignee_id: Leo, points: 3, recurrence: 'daily', due_date: days(0), icon: 'BedDouble' },
    { title: 'Walk the dog', assignee_id: Ava, points: 8, recurrence: 'daily', due_date: days(0), icon: 'Dog' },
    { title: 'Vacuum living room', assignee_id: Riley, points: 10, recurrence: 'weekly', due_date: days(2), icon: 'Wind' },
    { title: 'Mow the lawn', assignee_id: Jordan, points: 15, recurrence: 'weekly', due_date: days(3), icon: 'Trees' },
    { title: 'Fold laundry', assignee_id: Ava, points: 7, recurrence: 'weekly', due_date: days(1), icon: 'Shirt' },
  ]);

  // ── Goals ──
  ins('goals', ['title', 'category', 'target', 'current', 'unit', 'member_id', 'due_date'], [
    { title: 'Family vacation fund', category: 'finance', target: 4000, current: 2350, unit: '$', due_date: days(120) },
    { title: 'Read 20 books this year', category: 'learning', target: 20, current: 11, unit: 'books', member_id: Ava },
    { title: 'Walk 10k steps daily (avg)', category: 'health', target: 10000, current: 7800, unit: 'steps', member_id: Jordan },
    { title: 'Declutter the garage', category: 'home', target: 100, current: 40, unit: '%' },
  ]);

  // ── Rewards ──
  ins('rewards', ['title', 'description', 'cost', 'icon'], [
    { title: 'Movie night pick', description: 'Choose the family movie', cost: 30, icon: 'Clapperboard' },
    { title: '30 min extra screen time', description: '', cost: 40, icon: 'Tv' },
    { title: 'Ice cream trip', description: 'A scoop of your choice', cost: 60, icon: 'IceCream' },
    { title: '$10 allowance bonus', description: '', cost: 100, icon: 'DollarSign' },
    { title: 'Friend sleepover', description: 'Invite a friend over', cost: 150, icon: 'Users' },
  ]);

  // ── Lists ──
  const gid = uuid();
  db.prepare(`INSERT INTO lists (id, household_id, name, type, icon, color) VALUES (?,?,?,?,?,?)`)
    .run(gid, hid, 'Groceries', 'grocery', 'ShoppingCart', '#10b981');
  const groceryItems = [
    ['Milk', '2 gal', 'Dairy'], ['Eggs', '1 dozen', 'Dairy'], ['Bananas', '', 'Produce'],
    ['Chicken breast', '2 lb', 'Meat'], ['Spinach', '', 'Produce'], ['Pasta', '2 boxes', 'Pantry'],
    ['Olive oil', '', 'Pantry'], ['Paper towels', '', 'Household'],
  ];
  const li = db.prepare(`INSERT INTO list_items (id, household_id, list_id, name, qty, category) VALUES (?,?,?,?,?,?)`);
  groceryItems.forEach(([n, q, c]) => li.run(uuid(), hid, gid, n, q, c));
  const tid = uuid();
  db.prepare(`INSERT INTO lists (id, household_id, name, type, icon, color) VALUES (?,?,?,?,?,?)`)
    .run(tid, hid, 'Weekend to-do', 'todo', 'ListChecks', '#6366f1');
  ['Wash the car', 'Return library books', 'Fix the fence gate'].forEach(n => li.run(uuid(), hid, tid, n, '', ''));

  // ── Recipes + meals ──
  const rid = uuid();
  db.prepare(`INSERT INTO recipes (id, household_id, name, description, ingredients, instructions, prep_minutes, servings, tags) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(rid, hid, 'Sheet-pan chicken fajitas', 'Weeknight favorite', JSON.stringify([
      { name: 'Chicken breast', qty: '1.5 lb' }, { name: 'Bell peppers', qty: '3' },
      { name: 'Onion', qty: '1' }, { name: 'Tortillas', qty: '8' }, { name: 'Fajita seasoning', qty: '1 pkt' },
    ]), 'Slice everything, toss with oil + seasoning, roast at 425°F for 20 min.', 30, 4, 'dinner,easy');
  ins('meals', ['date', 'meal_type', 'title', 'recipe_id'], [
    { date: days(0), meal_type: 'dinner', title: 'Sheet-pan chicken fajitas', recipe_id: rid },
    { date: days(1), meal_type: 'dinner', title: 'Spaghetti & meatballs' },
    { date: days(2), meal_type: 'dinner', title: 'Taco Tuesday' },
    { date: days(3), meal_type: 'dinner', title: 'Grilled salmon & veggies' },
    { date: days(0), meal_type: 'breakfast', title: 'Pancakes' },
  ]);

  // ── Bills ──
  ins('bills', ['name', 'amount', 'category', 'frequency', 'next_due', 'autopay', 'status'], [
    { name: 'Mortgage', amount: 1850, category: 'housing', frequency: 'monthly', next_due: days(5), autopay: 1, status: 'upcoming' },
    { name: 'Electric — PowerCo', amount: 142.5, category: 'utilities', frequency: 'monthly', next_due: days(8), status: 'upcoming' },
    { name: 'Internet — FiberNet', amount: 79.99, category: 'utilities', frequency: 'monthly', next_due: days(-1), status: 'overdue' },
    { name: 'Car insurance', amount: 168, category: 'auto', frequency: 'monthly', next_due: days(12), autopay: 1, status: 'upcoming' },
    { name: 'Netflix', amount: 22.99, category: 'subscriptions', frequency: 'monthly', next_due: days(15), autopay: 1, status: 'upcoming' },
    { name: 'Water & sewer', amount: 64, category: 'utilities', frequency: 'monthly', next_due: days(20), status: 'upcoming' },
  ]);

  // ── Finance ──
  ins('accounts', ['name', 'type', 'balance', 'institution'], [
    { name: 'Everyday checking', type: 'checking', balance: 6240.18, institution: 'First National' },
    { name: 'Emergency savings', type: 'savings', balance: 18500, institution: 'First National' },
    { name: 'Vacation fund', type: 'savings', balance: 2350, institution: 'Ally' },
    { name: 'Visa rewards', type: 'credit', balance: 1240.55, institution: 'Chase' },
    { name: 'Car loan', type: 'loan', balance: 11200, institution: 'Toyota Financial' },
  ]);
  ins('budgets', ['category', 'monthly_limit', 'icon'], [
    { category: 'groceries', monthly_limit: 800, icon: 'ShoppingCart' },
    { category: 'dining out', monthly_limit: 300, icon: 'Utensils' },
    { category: 'auto & maintenance', monthly_limit: 250, icon: 'Car' },
    { category: 'entertainment', monthly_limit: 150, icon: 'Clapperboard' },
    { category: 'utilities', monthly_limit: 450, icon: 'Zap' },
  ]);
  const tx = db.prepare(`INSERT INTO transactions (id, household_id, type, amount, category, description, date) VALUES (?,?,?,?,?,?,?)`);
  const txData = [
    ['income', 5200, 'salary', 'Paycheck', days(-10)],
    ['expense', 412.33, 'groceries', 'SuperMart', days(-8)],
    ['expense', 64.2, 'dining out', 'Pizza night', days(-6)],
    ['expense', 142.5, 'utilities', 'Electric bill', days(-5)],
    ['expense', 88.0, 'entertainment', 'Movie + snacks', days(-4)],
    ['expense', 230.0, 'groceries', 'Costco run', days(-2)],
    ['income', 150, 'other', 'Yard sale', days(-2)],
    ['expense', 49.99, 'auto & maintenance', 'Oil change', days(-1)],
  ];
  txData.forEach(t => tx.run(uuid(), hid, ...t));

  // ── Utilities ──
  ins('utilities', ['name', 'provider', 'type', 'account_number', 'monthly_estimate', 'unit'], [
    { name: 'Electricity', provider: 'PowerCo', type: 'electric', account_number: '****4821', monthly_estimate: 142, unit: 'kWh' },
    { name: 'Water & Sewer', provider: 'City Utilities', type: 'water', account_number: '****9032', monthly_estimate: 64, unit: 'gal' },
    { name: 'Natural Gas', provider: 'Metro Gas', type: 'gas', account_number: '****1188', monthly_estimate: 58, unit: 'therm' },
    { name: 'Internet', provider: 'FiberNet', type: 'internet', account_number: '****7741', monthly_estimate: 80, unit: '' },
  ]);

  // ── Assets + maintenance ──
  const carId = uuid();
  db.prepare(`INSERT INTO assets (id, household_id, name, type, make, model, year, identifier, purchase_price, current_value, mileage, icon)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(carId, hid, 'Family SUV', 'vehicle', 'Toyota', 'Highlander', 2021, '1HG····VIN', 38000, 29500, 41200, 'Car');
  const car2 = uuid();
  db.prepare(`INSERT INTO assets (id, household_id, name, type, make, model, year, purchase_price, current_value, mileage, icon)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(car2, hid, 'Commuter sedan', 'vehicle', 'Honda', 'Civic', 2018, 22000, 14000, 78400, 'Car');
  ins('assets', ['name', 'type', 'make', 'model', 'purchase_price', 'current_value', 'icon', 'warranty_expires'], [
    { name: 'Refrigerator', type: 'appliance', make: 'LG', model: 'InstaView', purchase_price: 2400, current_value: 1500, icon: 'Refrigerator', warranty_expires: days(200) },
    { name: 'HVAC system', type: 'home', make: 'Carrier', model: 'Infinity', purchase_price: 6800, current_value: 5200, icon: 'Wind' },
    { name: 'Lawn mower', type: 'tool', make: 'Honda', model: 'HRX', purchase_price: 650, current_value: 400, icon: 'Trees' },
  ]);
  const mt = db.prepare(`INSERT INTO maintenance (id, household_id, asset_id, title, type, due_date, due_mileage, recurrence_months, recurrence_miles, provider, status)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  mt.run(uuid(), hid, carId, 'Oil change', 'service', days(6), 44000, 6, 5000, 'Toyota Service', 'upcoming');
  mt.run(uuid(), hid, carId, 'Tire rotation', 'service', days(14), 44000, 6, 5000, 'Toyota Service', 'upcoming');
  mt.run(uuid(), hid, carId, 'Registration renewal', 'registration', days(-2), null, 12, 0, 'DMV', 'overdue');
  mt.run(uuid(), hid, car2, 'Brake inspection', 'inspection', days(25), 80000, 12, 12000, '', 'upcoming');
  mt.run(uuid(), hid, carId, 'State inspection', 'inspection', days(40), null, 12, 0, '', 'upcoming');

  // ── Contacts ──
  ins('contacts', ['name', 'relationship', 'category', 'phone'], [
    { name: 'Poison Control', relationship: '', category: 'emergency', phone: '1-800-222-1222' },
    { name: 'Dr. Patel (Pediatrician)', relationship: 'Doctor', category: 'medical', phone: '555-0142' },
    { name: 'Maple Grove Elementary', relationship: 'School', category: 'school', phone: '555-0188' },
    { name: 'Mike — Plumber', relationship: 'Service', category: 'service', phone: '555-0173' },
    { name: 'Grandma Hart', relationship: 'Grandmother', category: 'family', phone: '555-0119' },
  ]);

  // ── Notes ──
  ins('notes', ['title', 'body', 'color', 'pinned', 'author_id'], [
    { title: 'WiFi password', body: 'HartHome-Guest / maple2024', color: '#dbeafe', pinned: 1, author_id: Jordan },
    { title: 'Babysitter notes', body: 'Bedtime 8pm. Leo needs his night light. Emergency #s on the fridge.', color: '#fef3c7', author_id: Riley },
    { title: 'Costco list reminders', body: 'Always check the freezer before buying meat!', color: '#dcfce7', author_id: Jordan },
  ]);

  // ── Announcements + activity ──
  db.prepare('INSERT INTO announcements (id, household_id, author_id, body) VALUES (?,?,?,?)')
    .run(uuid(), hid, Riley, 'Reminder: trash goes out tonight! 🗑️');
  db.prepare('INSERT INTO announcements (id, household_id, author_id, body) VALUES (?,?,?,?)')
    .run(uuid(), hid, Jordan, 'Great job on chores this week, kids — pizza Friday! 🍕');

  ins('devices', ['name', 'type', 'pairing_code', 'widgets'], [
    { name: 'Kitchen wall display', type: 'wall', pairing_code: 'KTCHN1', widgets: '["clock","weather","calendar","chores","meals"]' },
    { name: 'Entryway tablet', type: 'tablet', pairing_code: 'ENTRY2', widgets: '["calendar","chores","lists"]' },
  ]);

  const act = db.prepare('INSERT INTO activity (id, household_id, member_id, member_name, type, message) VALUES (?,?,?,?,?,?)');
  act.run(uuid(), hid, Ava, 'Ava Hart', 'chore', 'completed "Walk the dog" (+8 pts)');
  act.run(uuid(), hid, Leo, 'Leo Hart', 'reward', 'redeemed "Movie night pick" for 30 pts');
  act.run(uuid(), hid, Jordan, 'Jordan Hart', 'bill', 'paid Water & sewer ($64.00)');

  console.log('  ↳ demo household ready — sign in with owner@harthome.demo / Demo123!');
};
