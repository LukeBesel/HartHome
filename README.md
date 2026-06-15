# 🏡 HartHome — The Command Center for Your Home

A full-stack, Skylight-style **family & home management** platform. HartHome
brings everything your household runs on into one calm, beautiful place — and
puts it on **any screen**, from your phone to a kitchen wall display.

It's the home companion to **HartMonitor** and shares its design language: a
deep midnight UI with an indigo→pink glow.

## ✨ What's inside

| Module | What it does |
|---|---|
| 🏠 **Home dashboard** | A live, glanceable overview of the whole household — today's schedule, chores, bills, goals, points race, bulletin & activity |
| 📅 **Calendar** | Shared, color-coded family calendar with per-member events, all-day events, categories, and an agenda view |
| ✅ **Chores** | Assign recurring chores, auto-award points, and roll daily/weekly tasks forward automatically |
| 🎯 **Goals** | Family & personal goals with progress bars, units ($/books/steps/%), and auto-completion |
| 🎁 **Rewards** | A points store where kids redeem screen time, treats & privileges — with parent approval |
| 🏆 **Leaderboard** | All-time / weekly / monthly points race with a podium |
| 🛒 **Lists & Groceries** | Smart grocery (grouped by aisle) and to-do lists everyone can edit |
| 🍽️ **Meal Plan** | Weekly planner + recipe box, and one-tap "turn the plan into a grocery list" |
| 🧾 **Bills** | Recurring bills that roll forward when paid and feed your budget; overdue tracking |
| 💰 **Budget** | Accounts, net worth, monthly cashflow, budget-vs-actual, and a 6-month trend chart |
| ⚡ **Utilities** | Providers, account numbers, and meter readings for electric/water/gas/internet |
| 🚗 **Assets & Maintenance** | Vehicles, appliances & home systems with service schedules by **date and mileage** (oil changes, registration, warranties) |
| ☎️ **Contacts** | Emergency, medical, school & service contacts with tap-to-call/email |
| 📄 **Documents** | An important-documents vault with renewal reminders |
| 👨‍👩‍👧 **Family** | Manage members & roles; kids get password-free profiles for shared screens |
| 📺 **Display mode** | A full-screen, auto-refreshing kiosk board for a wall tablet or TV |
| 📝 **Notes & Bulletin** | Sticky notes + a family message board |

Plus: dark mode, 7 accent themes, points & allowance tracking, birthday
reminders, and a household-isolated multi-tenant backend.

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, SQLite (better-sqlite3) |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS (shared HartMonitor design system) |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | React Router v6 |
| Auth | Token sessions, scrypt-hashed passwords, household-scoped roles |

## 🚀 Quick start

```bash
# Install everything (root + both workspaces)
npm run install:all

# Dev — API on :3001, UI on :5173 (with proxy)
npm run dev

# Production build + serve everything on :3001
npm run build && npm start

# Backend test suite (auth, tenant isolation, points, seeding)
npm test
```

Open **http://localhost:5173**. In development a demo household is seeded —
sign in with **owner@harthome.demo** / **Demo123!**, or click **Explore the
demo home** on the login screen. You can also create a fresh household via
**Get started**.

> Demo data only seeds when `SEED_DEMO_DATA=true` (set in `backend/.env` for
> local dev). Production databases start empty — the first signup becomes the
> household owner.

## 👪 Roles

`owner` › `parent` › `member` › `child`. Parents & owners manage members,
approve rewards, and edit household settings. Children can have **profile-only**
accounts (no email/password) and sign in by tapping their avatar on a shared
screen.

## 📺 Putting it on a screen

Open **Display mode** (sidebar, or `/display`) on any tablet, TV browser, or
wall-mounted screen. It shows a calm clock + weather + today's schedule, chores,
bulletin, and the points race, and auto-refreshes. Register named screens under
**Settings → Connected screens**.

## 🗂️ Project structure

```
HartHome/
├── backend/
│   └── src/
│       ├── index.js        # Express server + route wiring
│       ├── config.js       # Env config + startup validation
│       ├── db.js           # SQLite schema (all modules)
│       ├── seed.js         # Demo household
│       ├── crud.js         # Generic household-scoped CRUD factory
│       ├── middleware/auth.js
│       └── routes/         # auth, members, dashboard, chores, bills, finance, assets, …
└── frontend/
    └── src/
        ├── pages/          # 20+ pages (Dashboard, Calendar, Chores, Budget, Assets, Display…)
        ├── components/shared/  # Layout + UI kit
        ├── context/        # Auth, Theme
        ├── api/client.ts   # Typed API client
        └── utils/, hooks/
```

## ☁️ Deploy on Railway (just like HartMonitor)

The backend serves the built frontend, so the whole app runs as **one service**.

1. **New Project → Deploy from GitHub repo →** `LukeBesel/HartHome`.
2. Railway auto-reads [`railway.json`](./railway.json):
   build `npm install && npm run build`, start `node backend/src/index.js`,
   health check `/api/health`.
3. Add a **Volume** mounted at `/data`.
4. Set variables: `NODE_ENV=production`, `DATABASE_PATH=/data/harthome.db`, and
   `APP_URL=<your-railway-url>` (after first deploy). Leave `SEED_DEMO_DATA` unset.
5. Deploy → open the URL → **Get started free**.

A `Dockerfile` and `render.yaml` are included for container/Render deploys.
**Full step-by-step guide: [`LAUNCH.md`](./LAUNCH.md).**

---

© HartHome — part of the Hart family of products.
