const { crudRouter } = require('../crud');

module.exports = crudRouter({
  table: 'notes',
  fields: ['title', 'body', 'color', 'pinned', 'author_id'],
  orderBy: 'pinned DESC, updated_at DESC',
  label: 'note',
});
