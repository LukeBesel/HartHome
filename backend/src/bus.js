// Tiny in-process event bus used to push "something changed" pings to connected
// screens over Server-Sent Events, so a wall display updates the instant someone
// checks a chore or adds an event — no manual refresh needed.
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(0); // many displays can subscribe at once

// Emit a change scoped to a household. `table` is a hint for clients.
function emitChange(householdId, table) {
  if (householdId) bus.emit('change', { householdId, table, at: Date.now() });
}

module.exports = { bus, emitChange };
