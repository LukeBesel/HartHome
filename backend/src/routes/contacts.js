const { crudRouter } = require('../crud');

module.exports = crudRouter({
  table: 'contacts',
  fields: ['name', 'relationship', 'category', 'phone', 'email', 'address', 'notes'],
  filters: ['category'],
  orderBy: `category='emergency' DESC, name ASC`,
  label: 'contact',
});
