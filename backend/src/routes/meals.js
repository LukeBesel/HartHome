const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { crudRouter } = require('../crud');
const { logActivity } = require('../helpers');

const router = express.Router();

// POST /grocery — push the ingredients of this week's planned meals onto a
// grocery list (creating one if needed). Turns the meal plan into a shop run.
router.post('/grocery', (req, res) => {
  const { start, end } = req.body;
  const meals = db.prepare(
    `SELECT * FROM meals WHERE household_id = ? AND date >= ? AND date <= ?`
  ).all(req.householdId, start, end);

  // Find or create a grocery list.
  let list = db.prepare(`SELECT * FROM lists WHERE household_id = ? AND type = 'grocery' ORDER BY created_at LIMIT 1`).get(req.householdId);
  if (!list) {
    const id = uuid();
    db.prepare(`INSERT INTO lists (id, household_id, name, type, icon, color) VALUES (?, ?, 'Groceries', 'grocery', 'ShoppingCart', '#10b981')`).run(id, req.householdId);
    list = db.prepare('SELECT * FROM lists WHERE id = ?').get(id);
  }

  let added = 0;
  for (const meal of meals) {
    if (!meal.recipe_id) continue;
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND household_id = ?').get(meal.recipe_id, req.householdId);
    if (!recipe) continue;
    let ingredients = [];
    try { ingredients = JSON.parse(recipe.ingredients || '[]'); } catch { /* malformed */ }
    for (const ing of ingredients) {
      const name = typeof ing === 'string' ? ing : ing.name;
      const qty = typeof ing === 'object' ? (ing.qty || '') : '';
      if (!name) continue;
      db.prepare(
        `INSERT INTO list_items (id, household_id, list_id, name, qty, category) VALUES (?, ?, ?, ?, ?, 'From meal plan')`
      ).run(uuid(), req.householdId, list.id, name, qty);
      added++;
    }
  }
  logActivity(req.householdId, req.user, 'meal', `added ${added} ingredients to the grocery list`);
  res.json({ ok: true, list_id: list.id, added });
});

router.use('/recipes', crudRouter({
  table: 'recipes',
  required: ['name'],
  fields: ['name', 'description', 'ingredients', 'instructions', 'prep_minutes', 'servings', 'tags'],
  orderBy: 'name ASC',
  label: 'recipe',
}));

router.use(crudRouter({
  table: 'meals',
  required: ['title', 'date'],
  fields: ['date', 'meal_type', 'title', 'notes', 'recipe_id'],
  filters: ['date', 'meal_type'],
  orderBy: 'date ASC, meal_type ASC',
  label: 'meal',
}));

module.exports = router;
