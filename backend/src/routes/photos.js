const { crudRouter } = require('../crud');

// Family photos for the slideshow / wall display. `url` may be an external
// image URL or a data: URL (the upload UI converts files client-side), so no
// file storage is required on the server.
module.exports = crudRouter({
  table: 'photos',
  required: ['url'],
  fields: ['url', 'caption', 'sort'],
  orderBy: 'sort ASC, created_at DESC',
  label: 'photo',
});
