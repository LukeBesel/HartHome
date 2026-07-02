# HartHome — Release QA Checklist

Run `npm test` first (all green), then walk through this on a real browser
(desktop + one phone-sized window). ~15 minutes.

## Accounts & household
- [ ] Create a new household (sign-up) → lands on an empty dashboard, no demo data
- [ ] Copy invite code from Settings → join from a second browser ("Join home" tab) → same household
- [ ] Add a child profile (no email) → switch profiles from the sidebar menu → PIN prompt if set
- [ ] Log out clears the session; back button doesn't reveal data

## Core daily flow
- [ ] Add an event from the calendar (month view tap) → appears on dashboard + Display instantly (second window)
- [ ] Drag an event to another day (month + week views) → date shifts
- [ ] Add a chore with points + rotation between 2 members → complete it → points awarded, assignee rotates, activity feed updates
- [ ] Redeem a reward as a kid → pending approval appears for the parent → approve
- [ ] Add grocery items; check them off from a second device in real time
- [ ] Plan a meal with a recipe → "Generate grocery list" adds ingredients
- [ ] Pay a recurring bill → rolls to next month + transaction recorded in Budget

## Protection & privacy
- [ ] Set the finance passcode as a parent → Bills/Budget/Utilities ask for it (session-remembered)
- [ ] As a child: money pages hidden from nav, dashboard money cards gone, `/api/bills` returns 403
- [ ] Health: adult member's data invisible to others until they change sharing; child manageable by parent

## Display / kiosk
- [ ] `/display` shows clock, weather, schedule, chores, bulletin, points
- [ ] Tap a chore on the Display → check animation + toast + points
- [ ] Display settings gear: toggle widgets, switch background (incl. photo), 24h clock — persists after reload

## Resilience
- [ ] Create a chore with an empty title → friendly error (not a crash/500)
- [ ] Kill the network briefly → app recovers; SSE reconnects (make a change from a second window after)
- [ ] Visit every sidebar page — none white-screens (ErrorBoundary shows a recovery card if one does)

## Production build
- [ ] `npm run build && npm start` (with `NODE_ENV=production`, no SEED flag) → sign-up works, banner shows `demo seeding : off`
- [ ] `/api/health` returns `{"status":"ok"}`
