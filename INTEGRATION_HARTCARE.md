# HartHome ↔ HartCare integration

HartHome is the **identity hub** for the family. This guide covers the
**HartCare side** needed to complete the integration. The HartHome side is
already built:

- **Launcher** — sidebar "HartCare" button + a dashboard tile (shown once a
  parent sets the HartCare URL in **Settings → HartCare**).
- **SSO hand-off** — `POST /api/sso/handoff` (authenticated) mints a one-time,
  3-minute token and HartHome opens `‹HARTCARE_URL›/sso?token=…`.
- **Verify endpoint** — `GET /api/sso/verify?token=…` (public, CORS `*`,
  single-use) returns the member + household identity.
- **Live tile** — the dashboard tile calls `‹HARTCARE_URL›/api/summary?token=…`
  and renders it if present (otherwise it's just a launch card).

## 1. Configure HartHome (done in the app)

A parent opens **Settings → HartCare** and sets the HartCare base URL, e.g.
`https://hartcare.up.railway.app`. Store HartHome's base URL in HartCare as
`HARTHOME_URL` (e.g. `https://harthome.up.railway.app`).

## 2. Add an SSO entry route in HartCare: `/sso`

When HartCare is opened at `/sso?token=…`, exchange the token for identity and
start a HartCare session.

```ts
// app/sso/page.tsx (Next.js) — or equivalent
const token = new URLSearchParams(location.search).get('token');
const res = await fetch(`${process.env.NEXT_PUBLIC_HARTHOME_URL}/api/sso/verify?token=${token}`);
if (!res.ok) { /* show "link expired" + button back to HartHome */ }
const { user, household } = await res.json();
// user: { id, display_name, email, role, avatar_color }
// household: { id, name }
// → upsert this user in Supabase (key on email or a harthome_user_id column),
//   create a HartCare session, then redirect to the HartCare dashboard.
```

Map identity to HartCare's Supabase auth however you prefer:
- **Simplest:** treat `user.email` as the account key; create/sign-in that user.
- **Cleanest:** store `harthome_user_id` + `harthome_household_id` columns so a
  HartHome household maps to a HartCare family.

The token is **single-use and expires in 3 minutes** — verify it server-side or
immediately on load; don't store it.

## 3. (Optional) "Continue with HartHome" button in HartCare

Point it at `‹HARTHOME_URL›/login` (the user signs into HartHome, then taps the
HartCare launcher) — or, if HartCare is opened standalone, send the user to
HartHome and let them launch HartCare from there.

## 4. (Optional) Live summary for the HartHome dashboard tile

Implement `GET /api/summary?token=…` in HartCare. Validate the token via
HartHome's verify endpoint, then return today's wellness snapshot:

```ts
// GET /api/summary?token=…  → JSON, CORS allow the HartHome origin
{
  "headline": "Great activity day!",
  "steps": 8432,
  "activeMinutes": 47,
  "sleepHours": 7.5,
  "reminders": ["Dad: 2pm cardiology follow-up", "Refill Ava's inhaler"]
}
```
All fields optional — the HartHome tile renders whatever it gets. Add the
HartHome origin to HartCare's CORS allow-list for this route.

## 5. Two-way: read HartHome data from HartCare

When HartCare verifies a hand-off token, the response now also includes a
**long-lived `link_token`**. Store it against the HartCare family. Use it to pull
HartHome household context so HartCare can show the shared family + calendar:

```ts
// Persist link_token from the /sso/verify response, then:
const ctx = await fetch(`${HARTHOME_URL}/api/integrations/context`, {
  headers: { 'X-HartLink': link_token },
}).then(r => r.json());
// → { household:{id,name},
//     members:[{id,display_name,avatar_color,role,birthday}],
//     events:{ today:[…], upcoming:[…] } }
```

This endpoint is **read-only**, CORS-open, and scoped to the household by the
link token. It's the inbound half of the bridge; `/api/summary` (step 4) is the
outbound half that feeds the HartHome dashboard tile.

## Security notes
- The hand-off token is the credential — it's random, single-use, 3-minute TTL,
  and HartHome never exposes session tokens or password/finance-PIN hashes.
- `verify` returns only display fields (name, email, role, avatar color) and the
  household id/name.
- Everything still works with HartCare in demo mode; SSO simply no-ops if the
  HartCare URL isn't set in HartHome.
