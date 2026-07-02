const { crudRouter } = require('../crud');

// Saved, household-shared theme presets. The `theme` field holds the full
// ThemePrefs object (stringified by the CRUD layer); every member can apply or
// manage them, so a family can share one look across all their devices.
module.exports = crudRouter({
  table: 'household_themes',
  required: ['name', 'theme'],
  fields: ['name', 'theme', 'created_by'],
  orderBy: 'created_at DESC',
  label: 'theme',
});
