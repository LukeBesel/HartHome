const { crudRouter } = require('../crud');

module.exports = crudRouter({
  table: 'events',
  required: ['title', 'start_at'],
  fields: ['title', 'description', 'location', 'start_at', 'end_at', 'all_day', 'member_id', 'color', 'category', 'recurrence'],
  filters: ['member_id', 'category'],
  orderBy: 'start_at ASC',
  label: 'event',
  activity: true,
});
