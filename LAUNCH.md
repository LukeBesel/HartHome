# 🚀 Launch HartHome on Railway

HartHome deploys exactly like HartMonitor: a single Node service that builds the
React frontend and serves it alongside the API. No separate frontend host, no
database server to manage — SQLite lives on a persistent volume.

---

## Option A — Deploy from GitHub (recommended)

1. **Push this repo to GitHub** (already done on your branch — merge the PR to
   `main` or point Railway at the branch).
2. Go to **[railway.app](https://railway.app) → New Project → Deploy from GitHub
   repo** and pick `LukeBesel/HartHome`.
3. Railway reads [`railway.json`](./railway.json) automatically:
   - **Build:** `npm install && npm run build`
   - **Start:** `node backend/src/index.js`
   - **Health check:** `/api/health`
4. Add a **Volume** so your data survives redeploys:
   - Project → your service → **Variables/Volumes → New Volume**
   - Mount path: **`/data`**
5. Set these **Variables** (service → Variables):
   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_PATH` | `/data/harthome.db` |
   | `APP_URL` | your Railway URL (e.g. `https://harthome-production.up.railway.app`) — set after the first deploy, then redeploy |

   > ⚠️ Leave `SEED_DEMO_DATA` **unset** in production. It ships the known demo
   > login (`owner@harthome.demo`). Your first real signup becomes the household
   > owner and the database starts empty.
6. Click **Deploy**. When the health check at `/api/health` goes green, open the
   generated URL — you'll land on the HartHome marketing site. Click **Get
   started free** to create your household.

That's it. 🎉

---

## Option B — One service via Docker

A multi-stage [`Dockerfile`](./Dockerfile) is included. On Railway choose
**Deploy → Dockerfile**, or run anywhere that takes a container:

```bash
docker build -t harthome .
docker run -p 3001:3001 -e NODE_ENV=production -e DATABASE_PATH=/data/harthome.db -v $(pwd)/data:/data harthome
```

[`render.yaml`](./render.yaml) is provided for Render.com blueprint deploys.

---

## Run it locally first

```bash
npm run install:all      # installs root + backend + frontend
npm run dev              # API on :3001, UI on :5173 (proxied)
```

Open **http://localhost:5173**. In dev a demo household is seeded — sign in with
**owner@harthome.demo** / **Demo123!**, or click **Explore the demo home**.

To run the production build exactly as Railway does:

```bash
npm install && npm run build      # build the SPA into frontend/dist
node backend/src/index.js         # serves API + SPA on :3001
```

---

## Environment variables

Everything is optional except in production. See
[`backend/.env.example`](./backend/.env.example) for the full list.

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Port to listen on | Railway sets this; falls back to `3001` |
| `NODE_ENV` | `production` enables CORS lockdown & generic error messages | `development` |
| `DATABASE_PATH` | SQLite file location — point at the `/data` volume | in-repo `harthome.db` |
| `APP_URL` | Public URL, used to lock down CORS in production | (request host) |
| `ALLOWED_ORIGINS` | Extra browser origins allowed to call the API | (same-origin only) |
| `SEED_DEMO_DATA` | `true` seeds the demo household — **dev only** | off |

---

## Going live — quick polish

- Set `APP_URL` to your real domain and redeploy.
- Confirm the startup banner shows `environment : production` and
  `demo seeding : off`.
- Custom domain: Railway → service → **Settings → Networking → Custom Domain**,
  then update `APP_URL`.
- Smoke test: create a household → add a member → add a chore → complete it
  (points award) → open **Display mode** on a tablet.
- Rebrand if desired: search the repo for `HartHome` and `harthome.io`.
