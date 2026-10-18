# Dashboard

A personal life-dashboard **PWA**. One owner uses it daily, installed as a home-screen app on an iPhone and also on a PC. A few friends have their own accounts. Live at **https://y-tdashh1-black.vercel.app** (Vercel project `y-tdashh1`, scope `tom-efrati-s-projects`). Repo: **https://github.com/rrgehbsb/Dashboard** (the old lowercase `dashboard` URL redirects here).

---

## 0. Where we left off (read this first)

**State on 2026-10-18: v2.8.0 is live.** A big redesign ("v3") is in progress. The new design runs **next to** the classic app, and the user can switch between them at any time.

### Why the redesign
The owner stopped using the app for months. In their words: *"more isn't better… it felt like a duty… I needed to scroll and find and add a lot of numbers… it wasn't eye-pulling."* The goal is an app that **tracks, informs and saves time**, with far less on screen and almost no typing. See §2 for the rules that follow from this.

### The owner's priorities (they chose these)
- **Core:** **Gym**, **School + Transport as ONE page** (their school day *is* their commute), and the **To-do list** (they really like it).
- **Secondary:** **Food** (useful) and **Water** (somewhat useful, so keep it to a one-tap chip).
- **Everything else is hidden, not deleted:** Health, Finance, Habits, Projects, Friends, Trends, Summary, Coach, XP/levels, the buddy, and the skins/themes. The data and pages stay reachable from v3 Settings → "More pages".
- **Design:** the owner picked **"Daylight Blocks"**: bright, bold, solid colour blocks with chunky type, in light and dark. The pull should come from **honest, instant payoff on every visit** (useful info in one second, satisfying feedback on every tap). It should not come from decoration, streaks or guilt. The owner said they only open Instagram/TikTok out of dopamine habit, so don't copy those mechanics.

### Done
- **Saved copy of the old app:** branch **`classic`** and tag **`classic-v2.7.8`** on GitHub. This is the exact pre-redesign app.
- **v3 Today screen** (`/v3/`), live and working:
  - one "Now" hero card, then Gym / School / Food tiles
  - the to-do list as the main card: Today | Tomorrow, pin, move, delete with undo, older tasks folded away
  - the water chip and a Settings sheet
- **Design switch:**
  - classic Settings → "Try the new design"
  - v3 Settings → "Use the classic design"
  - `/index.html?classic` always forces classic
- **Not yet tested with the owner's real account.** Testing so far used demo data only. The owner was asked to try it and to check that their to-do list matches and that it syncs phone ↔ PC.

### Next steps, in order
1. **School + commute page (`/v3/school.html`)**. This is the next job. Full spec in §4.
2. **Gym page (`/v3/gym.html`)**: opens on today's workout, sets pre-filled, one tap per set, rest timer, session summary.
3. **Food page (`/v3/food.html`)**: "What did you eat?" sentence box first, quick chips, compact ring, diary showing only meal groups that have entries.
4. Make v3 the default for new accounts, then a cleanup release.

When a v3 page ships, add its key to `window.DASH_V3_PAGES` (read by `renderNav` in `v3/core.js`) so the bottom-nav tab links to the v3 page instead of the classic one.

### Reference material (in this repo)
- `docs/redesign/plan.md`: the full redesign plan. Its keep/automate/merge/cut lists, home-screen spec, motion and colour rules, data preservation and phased plan are the source of truth for v3 decisions. Its version numbers are older than what actually shipped. In its design-language section the colour and type values belong to the other look ("Night Signal"), which was **not** chosen: use `v3/app.css` for the real tokens.
- `docs/redesign/critique.md`: the owner's-advocate corrections. Apply these: no gym tier/rank chip, no daily gym nag, no duty copy, an honest "Timetable" label until trains are live, and the first open after months away must not flood the screen.
- `docs/redesign/mockup.html`: the clickable mockup the owner approved. It is the **visual and interaction reference** for every v3 page, and its JS has working prototypes of the School commute card and journey line, quick-add parser, gym set pills and rest timer, session summary, and food AI box. Port from it; don't redesign. Open it locally to see it (`node tools/serve.js .` then http://localhost:5178/docs/redesign/mockup.html).
- `docs/redesign/inventory/*.json`: the per-page audit of every classic feature (friction, value, storage keys). Check it before touching a classic page's data.

---

## 1. Stack

- Vanilla HTML/CSS/JS. **No build step, no framework, no npm dependencies.** `package.json` is empty on purpose.
- Supabase (auth + Postgres) called straight from the browser with the public anon key. Vercel serverless functions in `api/` handle anything that needs a secret.
- Hosting is Vercel. **Pushing to `main` deploys.** There is no local dev server in the normal workflow; changes are tested on the live site from the phone. For local checks, see §7.

---

## 2. How to work with this owner

- **Less is more.** Never add features by default. Prefer cutting, merging, automating, or hiding things behind a detail sheet. Judge every change by *what it asks the owner to do* against *what it gives back*. Anything new must replace something or live in a sheet; Today never gains a new block.
- **Lead with a recommendation.** The owner is not technical and can feel lost. Explain in plain language, make the call, and ask only questions that genuinely need their answer.
- **Standing permission to deploy:** after each batch of changes, bump the version (§6), commit straight to `main` and push. Don't ask first, but always tell them it's live.
- **Verify in the real app, not from source.** For bugs, reproduce them in a real browser at **phone width (390px) AND desktop width**, because the owner uses both. Screenshot and look before claiming a fix.
- **Every feature must sync across devices, in BOTH directions** (phone → PC and PC → phone). See §5. This has burned the owner repeatedly, and they check it.
- Hide, never delete, user data.

---

## 3. v3 (the new design)

### Files
```
v3/app.css     Design system ("Daylight Blocks"): tokens (light-first + dark), components
               (hero, tiles, to-do rows, sheets, toasts, pills, nav). Shared by all v3 pages.
v3/core.js     window.DASH: session/auth guard, Row() merge-safe synced rows, settings row,
               water chip, rings + count-up numbers, toast, sheets (SHEETS registry),
               actions (ACT registry, click delegation via data-act), long-press (LP, data-lp),
               bottom nav (TABS + DASH_V3_PAGES), Settings sheet, boot().
v3/index.html  Today page shell (icon <symbol> sprite, header, hero/tiles slots, to-do card).
v3/today.js    Today logic: rollover, to-do actions, hero/tile models.
```
Every v3 page includes, in this order:
1. the Supabase CDN
2. the **single-client patch** (`s.__oneClient`), right after the CDN
3. the **`/*__acctGuard4*/` inline guard**
4. Google Fonts (Bricolage Grotesque + Onest)
5. `/v3/app.css?v=X`, then `core.js?v=X` and the page script

The `?v=` must be bumped with the version. Copy the `<head>` from `v3/index.html`.

### The design switch
- `settings.ui` is `'v3'` or `'classic'`, stored in the synced `uid:settings` row (and in localStorage `dashboard:settings:v1`).
- Classic `index.html` has an early `/*__v3switch*/` script that redirects to `/v3/` when `ui === 'v3'`, unless the URL has `?classic`.
- `DASH.switchDesign(to)` flushes settings to the cloud before navigating.
- `/v3/` stays reachable even if `ui` is classic.

### Data: v3 reads and writes the SAME rows and keys as the classic pages
| Row (`app_state.key`) | Keys v3 uses | Notes |
|---|---|---|
| `uid:dashboard` | `goals:YYYY-MM-DD` = `[{text, done, queued?, carriedFrom?, later?}]` | To-do list. `queued` = pinned. `later` = parked by "Keep for later" (v3 only; classic ignores it). |
| `uid:school` | `dashboard:school:v1:subjects/assignments/tests/grades` | assignments `{id, subjectId, title, dueDate, status:'Todo'/'Done'}`; tests `{id, subjectId, name, testDate}` |
| `uid:po-coach` | `dashboard:gym:v1:template` (array of days `{id, name, exercises:[{id, name}]}`), `…:logs` (`{date:{exId:{set1:"82.5x6", …}}}`), `…:activeDay` | gym.html syncs these through a prototype-level localStorage override (iOS needs it). Logs need **entry-level merge** (see `mergeLogs` in gym.html). |
| `uid:food` | `days[YYYY-MM-DD].entries[]` (`nutrients.kcal/protein_g/…`, `group`), `custom` (targets), `library` | food.html merges days entry-level by id. |
| `uid:health` | `po_water_v1` (water), `po_coach_weights` (bodyweight) | The **health row embeds base64 progress photos**, so never `select('data')` it on Today. Use a JSON-path select (`data->po_water_v1`), as `core.js` does. |
| `uid:settings` | `name`, `ui`, `v3Theme`, plus all the classic fields | v3 only adds keys; it never removes classic ones. |

- **`Row(area)`** in `core.js` is the v3 sync primitive. Its rules are in the comment at the top of that file. Each row:
  - mirrors itself to localStorage `dash3:row:<area>`
  - takes an optional `seed` (import a classic local copy), `onLocal` / `onRemote` / `afterPush` hooks (Today uses them to keep classic's `dashboard:sync:v1` mirror in step, so switching back never shows stale data), and `readOnly`
- **Rollover** (`today.js`) moves unfinished past tasks onto today and writes each past day as `[]`. It **must not delete** past keys: a deleted key comes straight back from the cloud on the next merge-push. That was the classic "zombie tasks" bug.
- Tasks carried from more than 7 days ago are folded into one "N older tasks · Review" row (Keep for later / Clear all, with Undo). They never flood today.
- **Demo mode:** add `?demo` to any v3 URL for sample data, no login and **no storage writes**. Use it for screenshots.

### v3 design rules (from the plan and the critique)
- **Today:**
  - One saturated **hero** block per screen, chosen by rules and never repeated by a tile. Tiles show a calm line when empty, never "0/0".
  - Never write "log X" or guilt copy. Never show anything more than 7 days overdue.
- **Gone for good:** confetti, streaks, XP and anything that loops. Motion only responds to a tap or to real data changing.
- Nothing smaller than 13px. Tap targets of at least 44px. 16px side gutters. `prefers-reduced-motion` honoured.
- Use Undo toasts, never `confirm()` / `alert()`. Mobile Safari blocks `alert()`.
- Desktop (900px and wider): the nav becomes a left rail, Today goes to two columns, and other pages use a centred column of about 680px.

---

## 4. Next job in detail: School + commute (`/v3/school.html`)

One page: **commute card on top, then "Up next" (homework and tests), then a Grades row.** The owner also wants a **mini "Moovit"**: a live bus and train board inside the dashboard.

### The owner's commute (example data; every user sets their own)
- Walk 3 min → **bus 71, 72, 73 or 74** (Electra Afikim, Rosh HaAyin city lines) to **Rosh HaAyin North (ראש העין צפון) train station**. The ride is 29–34 min.
- Train to **Herzliya**, about 20 min.
- In Herzliya, two options. The app should compare them and pick:
  - **(a)** any line from the stop across the road, riding 2 stops, then a longer walk;
  - **(b)** line **33 or 34** (Metropoline), which drops them closer.
- Then walk about 8 min (less with option b) to school. **School: תיכון הנדסאים, Herzliya.**
- **Start times:**
  - Some days school starts **07:45, but the owner is allowed to arrive by 08:00** (their class travels from another city).
  - Add a per-weekday **"School starts"** and an optional **"I can arrive by"**. Plan the journey to the arrive-by time, while still showing the real start time.
  - Friends don't all have this permission, so it's off by default.
- **Friends** go to the same school but live in different places. So **every user picks their own bus line and boarding stop in the app** (searchable stop picker; the route adapts). Nothing is hard-coded to the owner.

### Requirements
- **Real departure times, not fixed durations.** The mockup's "bus = 34 min" is wrong. Build the chain from actual scheduled departures:
  - the user's bus at the user's stop → the train it can catch → the Herzliya bus waiting at that time.
  - The leave time must match a bus that actually exists.
  - Walks stay as fixed minutes.
- Bus times should use **live data** where available ("running 4 min late"). Fall back to the schedule with an honest label.
- Trains: until live data works, show the stored timetable labelled **"Timetable"**, and never say "Live" or "on time". The classic `transport.html` has `TRAIN_DEP_DEFAULTS` (a weekday list from June 2026; Friday times differ).
- **Time zones:** use `Intl` with `Asia/Jerusalem`, never a hard-coded offset. Vercel runs in UTC, and `api/train-times.js` currently uses `now.getHours()` (wrong). Israel switched to winter time on 25 Oct 2026.
- **Data to move:** `transport.html` stores its settings in the device-only `dashboard:transport:v1`. Copy them once into a synced key (e.g. `dashboard:school:v1:commute` in `uid:school`) so phone and PC agree. Then `transport.html` can redirect to the School page.
- **School "Up next":**
  - quick-add parser ("math hw thu"), with a preview chip before saving
  - one list sorted by date, with tap-to-complete plus Undo
  - items more than 14 days overdue go quietly to "Old"
  - a "+ score" chip on tests from the last 7 days (the score becomes a grade)
  - the Grades row only when grades exist
  - quick-add matches existing subjects fuzzily before creating new ones
- **API keys are server-side only.** Any transit proxy goes in `api/`.

### Transit data, as found on 2026-10-18
- **Buses: Hasadna open-bus "stride" API works.** `https://open-bus-stride-api.hasadna.org.il` is free, needs no key, and covers GTFS schedules plus SIRI real-time positions.
  - Endpoints: `/gtfs_routes/list`, `/gtfs_rides/list`, `/gtfs_ride_stops/list`, `/gtfs_stops/list?city=…`, `/siri_ride_stops/list`, `/siri_vehicle_locations/list`.
  - The full parameter list is in `/openapi.json`. GTFS route IDs change daily, but `line_ref` is stable.
  - Found: **71** → line_ref 27990 (operator 25, to Rosh HaAyin North). **74** → 27996 / 27997. **33** → 39474 (operator 15, Herzliya). **34** → 39476 / 39477.
  - **72 and 73 were not looked up yet.**
  - Likely needs a small `api/` proxy for caching and CORS (to be checked).
- **Trains: no working live source yet.**
  - The classic proxy (`api/train-times.js` → `www.rail.co.il/apiinfo/...`) returns **403** (bot block).
  - `rail-api.rail.co.il` with the public subscription key returned 404 on every path tried.
  - Israel Railways is **not** in the stride GTFS (route_type 2 returned nothing).
  - Still to try: the current endpoint the rail.co.il website itself calls (check the site's network requests), or the national GTFS feed (`gtfs.mot.gov.il`).

---

## 5. Sync: the rules that keep breaking (do NOT regress)

Per-user state lives in the Supabase table **`app_state`** (`key text PK, data jsonb, updated_at`), one row per area, keyed `"<uid>:<area>"`. Other tables: `profiles`, `friendships`, `nudges`, `activity` (see `friends-setup.sql`), `reminders`, `push_subscriptions`.

1. **Before every push AND pull, `await client.auth.getSession()`.** Stale tokens make queries silently return nothing.
2. **One Supabase client per page:** the inline `s.__oneClient` patch right after the CDN script. Several GoTrueClients fighting over the token caused stale pulls.
3. **Push = merge:**
   - fetch the cloud row
   - overlay only the keys changed on this device
   - stamp `_pushAt`
   - `upsert(..., {onConflict:'key'})`
   Never overwrite the whole object. That caused cross-device data loss.
4. **Pull = overlay** remote keys onto local. Never wipe local first.
5. **Change detection only with `remoteAt === lastRemoteAt`** (both values come from the cloud). Never compare `_pushAt` against this device's clock with `<` / `<=`: clock skew silently drops updates. Skip a pull only while a local push is in flight (`if (pushTimer) return`). Don't use `hasPendingPush` in poll guards.
6. **A key holding a growing array needs entry-level union merge** on both push and pull: weights by `dateKey`, photos by `id`, gym logs, food entries. **One key = one owning row.** Never sync the same key from two pages into different rows.
7. Pull on focus, `pageshow` and `visibilitychange`, plus a poll. Flush with a `keepalive` fetch on `pagehide`.
8. After a local save, skip pulls for about 4 s, so a just-logged value isn't clobbered (water uses `_waterLocalAt`).
9. **iOS Safari ignores overriding `localStorage` instance methods.** gym.html and finance.html override on the **prototype**, guarded with `this === window.localStorage`.
10. **A crash early in a page's script silently kills that page's sync** (it never reaches init). Guard every `arr[0].x`. To debug on a phone without a console, add a fixed on-screen error banner fed by `window.addEventListener('error' | 'unhandledrejection')`.
11. **Account guard (`/*__acctGuard4*/`, on every page):** it only *records* the real uid from the auth token. It must never wipe data. Switching accounts is cleaned up only by `login.html` → `wipeLocalForNewOwner`.
12. **Test sync both directions:** phone → PC and PC → phone.

---

## 6. Conventions

- **Version bump on every change:**
  - set `DASHBOARD_VERSION` in `topbar.js` and `CACHE_VERSION` in `sw.js` to the same version (e.g. `2.8.1` / `v2.8.1`)
  - bump `VERSION` in `v3/core.js` and the `?v=` on v3 asset links
  - otherwise the installed PWA keeps serving the stale cache
- **Commits:** straight to `main`. No branches or PRs, except the frozen `classic` backup branch, which must never be committed to. Messages look like `area: what changed (vX.Y.Z)` or `vX.Y.Z — summary`.
- **Deploy:** `git push origin main`. Vercel deploys in about 1 minute. Confirm by fetching `/topbar.js` and checking the version.
- Classic pages are large (100–280 KB). Edit them in place; never reformat whole files.
- Secrets never go in client code. Only the Supabase anon key belongs in the browser.
- No hard-coded personal data (the owner's plan, meals, route) as defaults. New accounts must start empty, because friends use the app.

---

## 7. Local testing

- `node tools/serve.js .` (from the repo root) serves the repo at http://localhost:5178.
  - Open `http://localhost:5178/v3/?demo` for v3 with sample data and no login.
  - The mockup is at `/docs/redesign/mockup.html`.
- `tools/shot-v3.js` uses **Playwright** to screenshot v3 Today at phone and desktop size, tap through the to-do list, water and settings, and check for errors, horizontal overflow and demo-mode storage writes. It runs with a frozen clock (18 Oct 2026, 16:20).
  - Setup: `npm i -g playwright && npx playwright install chromium`, then `PLAYWRIGHT_PATH=$(npm root -g)/playwright SHOT_DIR=<folder> node tools/shot-v3.js`.
  - It launches the installed Chrome (`channel:'chrome'`) and falls back to bundled Chromium.
- **Classic pages redirect to `login.html` without a session.** To test them, stub `auth.getSession` with an init script, or test on the live site.

---

## 8. Setup on a new machine

1. Install Git and Node.js, then `git clone https://github.com/rrgehbsb/Dashboard.git` and open the folder.
2. That's enough to work: no build, no install. (`npm install` does nothing.)
3. Optional, for the Vercel CLI:
   - `npm i -g vercel`, `vercel login`, `vercel link --project y-tdashh1 --scope tom-efrati-s-projects`
   - **Environment variables are type Sensitive in Vercel, so `vercel env pull` only writes `[SENSITIVE]` placeholders.** Real values must come from their original sources (Supabase dashboard, Anthropic console, etc.).
   - They're only needed to run `api/` locally (`vercel dev`), which the normal workflow doesn't do.
4. Older local copies exist on the owner's other devices (e.g. `Documents\GitHub\Dashboard`, last at v2.7.6). Always `git pull` before working. GitHub is the source of truth.

**Environment variables used by `api/`:**

| Variable | Status |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | set in Vercel |
| `ANTHROPIC_API_KEY` | set; the coach and food AI use it |
| `USDA_API_KEY` | set |
| `CRON_SECRET` | set |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | set |
| `NTFY_TOPIC` | **NOT set**, so push reminders (`send-push.js`, `cron-reminders.js`) fail |
| `OPENROUTER_API_KEY`, `COACH_API_KEY`, `COACH_MODEL` | optional, unset |

---

## 9. Classic app reference

```
index.html        Classic home (goals/to-do, day ring, Do Now, mood, mini tiles). Has the v3 redirect.
login.html        Supabase auth. Routes new users to onboarding.html.
onboarding.html   First-run tour (name, pages, theme).
settings.html     Settings, skins, nav, Pages & Kids Mode. Has the "Try the new design" button.
health.html       Water, weight + progress photos, supplements, sleep, body composition (row uid:health).
gym.html          Workout tracker + strength rank (row uid:po-coach).
food.html         Calorie tracker: USDA search, barcode, AI sentence parse, recipes (row uid:food).
school.html       Assignments, tests, grades, subjects (row uid:school).
transport.html    Israel Railways planner, "leave home by" (device-only settings).
habits.html  finance.html  projects.html  friends.html  coach.html  summary.html  trends.html
topbar.js         Shared module on every CLASSIC page (~220 KB): top bar, customizable bottom nav
                  (ALL_TABS, resolveNav), skin/theme engine (SKIN_DEFS), buddy widget, XP system
                  (dashboard:xp:v1 ↔ uid:xp), water pill + water live-sync, settings pull,
                  page-visibility guard (settings.pages, HIDEABLE_PAGES, guardPageAccess).
                  v3 pages do NOT load topbar.js.
sw.js             Service worker, network-first, cache name = CACHE_VERSION.
api/              Vercel functions (CommonJS): coach.js (AI chat; OpenRouter or Anthropic by key
                  prefix), food.js (USDA + LLM parse), barcode.js, steps.js, usage.js,
                  train-times.js (broken, see §4), cron-reminders.js (cron-job.org, CRON_SECRET),
                  get-/sync-reminders.js, subscribe.js, vapid-key.js, send-push.js.
friends-setup.sql Supabase schema for the friends feature.
docs/redesign/    Redesign plan, critique, approved mockup, feature inventory (see §0).
tools/            Local test server + Playwright screenshot script.
```
- Settings live in localStorage `dashboard:settings:v1`, auto-synced to `uid:settings`. Notable fields:
  - `pages` (`{key: bool}`, hide pages)
  - `mode` (`'kid'` = simplified)
  - `ui` (the design switch)
  - `name`
- The user id is cached in localStorage as `_dashUid`.
- The classic home stores goals in its `_db`, mirrored to localStorage `dashboard:sync:v1` and synced to `uid:dashboard`.
- Known classic bug, deliberately not fixed in classic: its `runRollover` deletes past `goals:` keys, which the merge-push resurrects. v3's rollover fixes this (§3).
