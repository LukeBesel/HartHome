const { crudRouter } = require('../crud');

module.exports = crudRouter({
  table: 'documents',
  fields: ['name', 'category', 'reference', 'expires_at', 'notes', 'file_data', 'file_name'],
  filters: ['category'],
  orderBy: 'expires_at IS NULL, expires_at ASC',
  label: 'document',
});
