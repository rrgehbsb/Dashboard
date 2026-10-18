# Dashboard

A personal life-dashboard **PWA**: health, gym, food, habits, finance, school, transport, friends, and an AI coach. It's built for one user and installed as a home-screen app on an iPhone.

- **Stack:** vanilla HTML/CSS/JS with **no build step, framework, or npm dependencies**. Each page is one self-contained `.html` file with inline `<style>`/`<script>`.
- **Backend:** Supabase (auth + Postgres) is called directly from the browser with the public anon key. Vercel serverless functions in `api/` handle anything that needs a secret.
- **Hosting:** Vercel. Pushing to `main` deploys. There's no local dev server in the workflow; changes are tested on the deployed site from the phone.

## Structure

```
index.html        Home page
login.html        Supabase auth
onboarding.html   First-run setup
settings.html     Settings, theme/skin picker, nav customization
health.html       Health (steps, body composition, etc.)
gym.html          Workout tracker / progressive-overload coach
food.html         Food logging (barcode + nutrition lookup)
habits.html  finance.html  school.html  projects.html
transport.html    Israel Railways train times
friends.html      Friends, activity, nudges
coach.html        AI coach chat
summary.html  trends.html
topbar.js         SHARED module loaded on every page (see below)
sw.js             Service worker (offline cache)
manifest.json, icon*.png, icon.svg, apple-touch-icon.png   PWA assets
friends-setup.sql Supabase schema for profiles / friendships / nudges / activity
api/              Vercel serverless functions (CommonJS, module.exports = handler)
screenshot_*.png, ss_*.png   Old reference screenshots
```

### topbar.js: the shared cross-page module
Every page loads it with `<script src="topbar.js" defer>`. Cross-cutting features live here, self-contained and injected at runtime:
- Top bar and the **customizable bottom nav** (`ALL_TABS`, `resolveNav`, `window.dashRebuildNav`; config stored in settings as `navCustom` / `navCount` / `navPinned`).
- **Theme/skin engine** (`SKIN_DEFS`), driven by the CSS vars `--accent`, `--accent2`, `--skin-font`. `settings.html` keeps a small `SKIN_VIS` map only to prevent a flash of the wrong theme.
- Chat **companion/buddy** widget (`BUDDY_DEFS`, `DEFAULT_BUDDY`).
- **XP/level** system (`window.dashAddXp`, `window.dashAddXpDaily`). It's stored under localStorage `dashboard:xp:v1` and synced to `uid:xp`, keeping whichever total is higher.

Put a new feature that should appear on every page in `topbar.js`, not in individual pages.

### Data model
- Per-user state lives in the Supabase `app_state` table, in rows keyed `"<uid>:<area>"` (e.g. `uid:settings`, `uid:health`, `uid:xp`).
- Settings live in localStorage `dashboard:settings:v1` and auto-sync to `uid:settings`.
- The user id is cached in localStorage as `_dashUid`.
- The other tables are `profiles`, `friendships`, `nudges`, `activity` (see `friends-setup.sql`) and `push_subscriptions` (reminders/push).

### api/ (serverless functions)
| File | Purpose |
|---|---|
| `coach.js` | AI coach chat proxy. It picks OpenRouter (`sk-or-`) or Anthropic (`sk-ant-`) based on the key prefix. |
| `food.js` | Nutrition lookup (USDA) and LLM food parsing |
| `barcode.js` | Open Food Facts barcode proxy |
| `steps.js` | Step sync bridge from the phone's health data |
| `usage.js` | App screen-time usage |
| `train-times.js` | Israel Railways (rail.co.il) proxy |
| `cron-reminders.js` | Runs every minute via cron-job.org; protected by `CRON_SECRET` |
| `get-reminders.js`, `sync-reminders.js` | Reminder storage in Supabase |
| `subscribe.js`, `vapid-key.js`, `send-push.js` | Web push / ntfy.sh notifications |

**Environment variables** are set in Vercel and **never committed**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `COACH_API_KEY`, `COACH_MODEL`, `USDA_API_KEY`, `CRON_SECRET`, `NTFY_TOPIC`, `VAPID_PUBLIC_KEY`. `.gitignore` excludes `.env*`, `.vercel`, `.netlify`, and `node_modules`.

## Conventions

- **Versioning (required on every change):** bump `DASHBOARD_VERSION` in `topbar.js` **and** `CACHE_VERSION` in `sw.js` to the same version (e.g. `2.7.7` / `v2.7.7`). If you skip this, the installed PWA keeps serving the stale cache.
- **Commits:** go straight to `main`. Don't use branches or PRs; it's a solo project. Messages look like `area: what changed (vX.Y.Z)` or `vX.Y.Z — summary`.
- **Deploy:** run `git push origin main`, and Vercel deploys automatically.
- Several pages are large (100–270 KB). Edit them in place and don't reformat whole files.
- Don't put secrets in client code. Only the Supabase anon key belongs in the browser; anything else goes through `api/`.
