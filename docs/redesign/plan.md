# Dashboard redesign decision: "Glance"

## 1. How the three directions score

Each direction is scored 1–10 against the owner's five criteria: (a) saves time, (b) saves space and clutter, (c) less complicated, (d) eye-pulling enough to open daily, (e) still tracks things and gives useful info.

| Criterion | A. Autopilot | B. One screen, 30 s | C. Night Signal |
|---|---|---|---|
| (a) Saves time | **9** | **9** | 8 |
| (b) Saves space | 7 | **10** | 8 |
| (c) Less complicated | 6 | **9** | 8 |
| (d) Eye-pulling, worth opening daily | 7 | 5 | **9** |
| (e) Tracks and gives useful info | **9** | 7 | 8 |
| **Total** | 38 | 40 | **41** |

**A. Autopilot** has the strongest automation and data thinking:
- live trains with a delay state, sets pre-filled for one-tap logging, a one-sentence AI food log
- an instant-paint cache, a real goal history, and a test score that becomes its grade

It is heavy, though. It has 15 phases and several new subsystems (holiday proxy, ingest endpoint, Sunday recap, a haptic trick), and the new home only arrives in phase 9. On a school morning the home also shows the commute twice, in the Now card and again in a Commute tile. The look is a competent utility: solid cards, many small tiles, little focus.

**B. One screen, 30 seconds** is the most disciplined:
- header, lanes, to-do, and nothing else; empty lanes are simply hidden
- 3 tabs and a 9-row Settings
- every confirm() dialog replaced by an Undo toast
- the to-do list moved to the front by phase 4 (v2.8.3)

But text-only lanes in a grouped list, with a single lime accent, read like a settings screen. That is calm, but flat, and flatness is the exact reason the owner stopped opening the app. It also takes Food out of the nav, even though the owner called Food "pretty useful".

**C. Night Signal** best fits the owner's own lesson that the pull should come from instant, honest reward:
- one coloured, live focal card per screen
- rings that fill from the value you last saw
- numbers that count up only when they really changed
- a big post-workout summary as the reward moment
- native Apple serif and rounded type, with no downloads

It keeps Food as a fourth tab. Its weaknesses: it renames Gym to "Lift" (needless relearning), it relies on swipe gestures nobody can see, it puts a weigh-in chip in the gym header although weight isn't a named priority, and only 4 to-do rows fit above the nav.

## 2. The recommended plan

**Spine: C (Night Signal).** It wins on the criterion that made the owner quit (d), and its 4 tabs match the stated priorities exactly.

**Grafts from B:**
- a hard screen budget, plus a rule that anything new goes in a sheet and never becomes a new block on Today
- Undo toasts instead of confirm()
- a long-press menu as the visible alternative to swipes
- a one-time, flagged archive step
- the to-do list first in the phase order
- Weigh-in lives in the Gym ⋯ menu, not as a header chip

**Grafts from A:**
- a cached snapshot so the screen paints instantly
- the goal-history fix for the dead streak and the "zombie" tasks that come back
- Now-card rules: ignore anything more than 7 days overdue, never say "log X", go amber on a delay
- a per-weekday school schedule with "off" days and a "No school until…" switch
- a passed test's score becomes its grade
- an optional Sunday one-liner

**Kept names:** Gym stays "Gym", and the merged page is "School".

---

### Pitch for the owner (plain language)

> Your dashboard becomes **four screens: Today, Gym, School, Food.** Each one opens on the answer you came for.
>
> **Today** tells you in one second when to leave for the train, what workout is next and what's due, with your to-do list right there and no scrolling. **Gym** opens on today's workout with every set already filled in with what you should lift; you tap once per set. **School** is your whole school day on one page: when to leave, which train, whether it's on time, then what's due. **Food** is there when you want it: say what you ate in one sentence. **Water** is one tap in the corner.
>
> Everything else (the health page, finance, habits, projects, friends, the coach, points, levels, the buddy, the themes) moves to a "More pages" list in Settings. **Nothing is deleted**, and any of it comes back with one switch.
>
> No points, no streaks to protect, no red "you missed it" warnings, no pop-ups when you open it. The reward is that each time you open it, something useful has changed (the countdown, the train, what's due), and every tap visibly finishes something: a task ticks off and slides away, a set fills in, a ring closes.

---

### Final lists

**Keep**
- The to-do list (`goals:YYYY-MM-DD`), with carry-over and pin (`queued`). The design is new; the stored format is identical.
- One-tap water (`po_water_v1`), as a small chip in the header. The target is still worked out from bodyweight.
- The gym tracker (`dashboard:gym:v1:template/logs/activeDay`):
  - the "Fill" prescription, which becomes the default value of every set
  - the rest timer, History, plan editing, and the merge-safe sync
- The Strength Rank engine, shown as a chip that opens a sheet, and the bodyweight log `po_coach_weights`, which rank and the food targets need.
- The transport "Leave home by" planner, with `TRAIN_DEP_DEFAULTS` kept as a fallback, and `/api/train-times` once it is fixed.
- School assignments, tests, grades and subjects, plus the urgency ranking and the summary sentence.
- Food:
  - the remaining-today ring with protein/carbs/fat bars
  - quick chips, the AI sentence log, Copy yesterday, date navigation, entry edit
  - Weekly Verdict with its Apply button, and library sync
  - search/USDA, barcode, quick add and recipe behind "More ways"
- The greeting header, the merge-based sync engines, the `settings.pages` guard, Export / Force update / Log out / AI allowlist, the service-worker auto-update, and the iOS fixes.
- `/api/steps` and `/api/usage` keep collecting silently in the background.

**Automate**
1. **Live trains.** `api/train-times.js` builds its query time from `now.getHours()` (line 37), which is UTC on Vercel. Fix it to use Asia/Jerusalem time, and confirm the station IDs (defaults `2300`/`8600`, lines 28–29) with `?stations=1`. Show delay and platform, and fall back to the stored timetable with a "timetable" label.
2. **Commute without daily taps:**
   - The direction (to school or home) is picked from the clock.
   - School start and end time are set once per weekday, with "off" days and "No school until…".
   - After the leave time it rolls on to the next train, then to the next school day. It never shows "time passed".
3. **The Now hero chooses itself** (rules below). It ignores anything more than 7 days overdue and never asks you to log.
4. **Home reads one query of all `<uid>:%` rows** (the pattern trends.html already uses), cached so the screen paints instantly. This fixes home reading stale per-device copies, including school data that today lives only in school.html's memory.
5. **Gym:**
   - The day is auto-picked as the next one in the plan after the last session.
   - Every set is pre-filled; one tap logs it and starts the rest timer.
   - Each lift's strength trend is rebuilt from the current logs.
6. **School quick-add** ("math hw thu", "bio test tue"):
   - It shows a preview chip before saving.
   - A subject is created the first time its name is used.
   - Priority is automatic, and done items hide after a day.
   - Once a test date passes, the app asks for the score once, and that score is saved as the grade.
7. **Food:**
   - One sentence goes to the AI estimate with "Add all"; the meal group comes from the time of day.
   - Quick chips are ranked by time of day, and each food remembers its last portion.
   - Targets come from one shared profile plus the latest weigh-in.
8. **Water target** comes from the latest weigh-in plus gym sessions per week, so the water settings form is no longer needed.
9. **"Since last time" count-ups.** Numbers animate only when they changed since your last visit. This uses a device-only last-seen cache.
10. **Optional, later:**
   - a "Leave in 10 min" push on school mornings and a "test tomorrow" push the evening before
   - a Sunday one-line recap
   - Apple Health weight ingest

**Merge**
- school.html + transport.html → **School**, with the commute on top; transport.html redirects to `school.html#commute`.
- Do This Now + day ring + Coach card + mini tiles → **Now hero + 3 tiles**.
- Today list + Plan Tomorrow + "Push remaining" → one list with a **Today | Tomorrow** switch.
- Assignments + Tests + Today's Focus + the 5 stat chips → one **Up next** list.
- The 5 "what should I lift" signals → **one prescription** shown as the pre-filled value; "closest rank-up" becomes one line in the Strength sheet.
- Rank hero + stats + per-lift grid + progress chart → a **Strength sheet**; the gym toolbar → one **⋯** menu.
- Weight logging → **Gym ⋯ › Weigh-in** (same key, same row).
- Top-bar water pill + water card + water history → a **header chip** plus a small sheet.
- Food's "This Week" bars + Weekly Verdict → **one Verdict card**.
- Home Reminders + transport ntfy buttons + the topic field → **Settings › Notifications**, with one delivery channel.
- Skins, surfaces, home looks, accent, card style, text size → **System / Dark / Light**.
- Profile facts typed in 3–4 places → **one shared profile** (sex, age, height).

**Cut** (stop showing it now; delete the code only in the final phase; never touch the data)
- **Points and games:** the XP and level display, the "+20 XP daily check-in" toast, badges, the streak-freeze shop, confetti, the gem card, and the friends 2-minute heartbeat.
- **Floating clutter:** the buddy, the 🧠 coach button, the left-edge drawer, the section ↑↓▾ arrows, the "More" fold, the layout picker, the page tabs, and the scroll-fade.
- **Theme engine:** skins, surface styles, home looks and structures, card style, text size, nav customisation, the dead settings fields, the Save button, and the version label in the top bar.
- **Home:** the title, day ring, streak chip, the dead ✨ Polish buttons, mood, Coach card, mini tiles, the separate Plan Tomorrow card, and the Reminders card.
- **Gym:**
  - the legacy split pill, the "Progressive Overload Coach" title and gear, and the legacy progress chart
  - the per-card coach chip and Coach Notes
  - failure badges and the notes field on the card face (both move into the card's ⋯)
  - the week-pinned session, "New session" and "Clear"
- **School:** the dead Pomodoro block, the stat chips, the "Command Center" header card, the subjects manager that is open by default, and long forms as the default way to add things.
- **Transport:** the 41-row train list, the mini columns, the comma-separated timetable editors on the page (one fallback editor moves into the commute sheet), the direction toggle, the manual alert buttons, and the date header.
- **Food:** micronutrient tiles, empty meal groups, the supplements note, the sheen animations, and the barcode tab on iOS.
- **All looping animations and all guilt copy** ("No mood logged", "missed dose", a June assignment headlined as "overdue!").
- **Archived** to Settings › More pages: Health, Habits, Finance, Projects, Friends, Trends, Summary, Coach. Onboarding stays only for brand-new accounts.

---

### New page structure

The nav is a floating pill with 4 fixed tabs, **Today · Gym · School · Food**, each with an SVG line icon and an 11px label. Settings opens from a gear on Today. Every page fits in about 1–1.3 phone screens, and every form opens as a bottom sheet.

**1. Today** (index.html). Header (greeting, water chip, gear), then the Now hero, then 3 tiles (Gym, School, Food), then the to-do card. Details are in the next section.

**2. Gym** (gym.html). It opens on today's workout.
- **Header:** the day name in serif ("Push"), "Day 2 of 3 · last: Pull, Thu", a small ▾ to switch day, a tier chip "Gold II ›", and ⋯. Below it, a session progress bar.
- **Exercise cards:** the name, a "Last 80×8 · 8 · 7" line, then a row of **set pills ghost-filled with today's prescription** ("82.5×6").
  - Tap a pill to log it: it fills orange with a pop, and the rest timer slides up.
  - Long-press a pill, or tap one already logged, to open an adjust sheet with a weight −/+ and rep pills. No keyboard is ever needed.
  - One-sided lifts get separate R/L pills.
  - A finished exercise collapses to "Bench ✓ 82.5×6·6·6 ↑ +2.5 kg vs last".
- **After the last set:** a **Session summary** card with sets, volume against last time, and any new best. This is the big reward moment.
- **⋯ menu:** History, Strength (rank grid, closest rank-up, 1RM sparklines), Weigh-in (± stepper prefilled with the last value), Edit plan and days, Add exercise. Each card's own ⋯ holds notes, the to-failure flag, edit, move and remove.

**3. School** (school.html; transport.html now redirects here).
- **(a) Commute hero.**
  - A "Leave in 14 min" countdown.
  - A journey line: "Walk 5 → Bus 74 06:58 → Train 07:19 · plat 2 · on time → School 08:00", with chips for the next options ("07:34", "07:49").
  - After school it shows "Next train home 14:21". On days off: "No school · next Sun, leave 06:44".
  - It shows "Live" or "Timetable" depending on where the times came from.
  - A gear opens the commute sheet: minutes for each leg, weekday times, "No school until…", and the fallback timetable.
- **(b) Up next.**
  - One summary sentence, then a quick-add line, then assignments and tests in a single list sorted by date.
  - Each row has a tap-to-complete circle (with Undo), a countdown pill (today, tomorrow, "Tue · 3d") and a TEST tag where relevant.
  - Tapping a row opens a short edit sheet (title, subject, date, then "more" for the rest).
- **(c) One row, "Grades · avg 87% ›"**, which opens the grades sheet.
- The ⋯ menu holds Subjects and Show done.

**4. Food** (food.html). Top to bottom:
- date ‹ › and the water chip
- a compact 120px ring with protein/carbs/fat bars, with no sheen
- a **"What did you eat?"** box with "Add all", designed for dictation
- quick chips plus Copy yesterday
- the diary, showing only meal groups that have entries, with one +
- the Verdict card (week bars, target line, Apply)
- "More ways" for search/USDA, barcode (hidden on iOS), quick add and recipe

**Settings** (no tab). Rows: Name; Appearance (System / Dark / Light); School week & commute; Water bottle size; Notifications (the reminders list, later the leave alert); **More pages** (each page with Open and "Show in nav"); Export my data; Force update; About (version and the 5-tap diagnostics); Log out; AI access (admin only).

---

### Home screen, top to bottom (390×844 iPhone)

The layout uses 16px side gutters and 12px gaps. The floating nav's top edge sits at about y 734.

1. **y 0–47: status bar.** No top bar, no toast, no version label.
2. **y 55–111: header.**
   - Left: "Sunday, 18 October" (13px, grey) above "Evening, Tom" (28px serif).
   - Right: the **water chip**, 36px tall, with a 20px aqua ring and "1.5 L".
     - Tap: adds one bottle; the ring sweeps forward and the number ticks up.
     - Hold: opens a sheet with Undo, sizes, a 7-day strip and the target.
   - Then a 36px gear for Settings.
3. **y 123–255: the Now hero** (132px). It is the only card with a colour wash, in its area's colour, and it is tappable. Exactly one answer is shown, chosen by these rules in order:
   1. A school day, from 2 hours before the leave time until the leave time:
      - "**Leave in 14 min**", with a 56px rounded number and a hairline bar draining toward the leave time.
      - Sub-line "Bus 74 06:58 → 07:19 train · plat 2 · on time", with alternative-time chips on the right.
      - It turns amber at ≤5 min or when the train is delayed.
   2. After school until about 17:00: "**Next train home 14:21** · on time".
   3. A workout in progress: "Push · 9 of 18 sets". After finishing: "Push done · Bench +2.5 kg".
   4. A test within 2 days, or something due today or tomorrow: "Math test · Tuesday".
   5. No workout yet, and the afternoon or a day off: "Next: Push · Bench 82.5×6 first".
   6. After 19:00: a tomorrow preview, e.g. "Tomorrow · leave 06:44 · Bio lab due".
   7. Otherwise: "Clear day · 3 of 5 done".

   It never says "log X", and it ignores anything more than 7 days overdue.
4. **y 267–355: three tiles**, each about 114×88 with a 30px area-coloured ring and a 26px number:
   - **Gym** (orange): the ring shows today's sets done out of planned; the value is "Push" or "9/18"; sub-line "2 this week".
   - **School** (blue): the value is "3 due"; sub-line "Bio test Tue".
   - **Food** (lime): the ring shows kcal eaten against the target; the value is "1,240"; sub-line "left · 95 g protein".

   An empty tile shows a calm line ("Rest day", "Nothing due") and never "0/0". The Food tile is hidden until targets exist.
5. **y 367–723: the to-do card.**
   - **Header row:** "Today", "2 of 5", and a [Today | Tomorrow] switch, with a 3px progress line under it.
   - **Input row (48px, at the top):** "Add a task" with a round + button; Return also adds.
   - **5 rows of 52px**, all above the nav. The first row starts at about y 463; today it starts at about y 770, under the nav.
     - Tap the circle: it fills lavender, the check draws itself, the text is struck through, and after 900ms the row folds into a "✓ 3 done ›" line.
     - Swipe left deletes (with Undo); swipe right moves the task to tomorrow. Long-press opens a menu (Pin, Tomorrow, Delete).
     - A carried-over task shows a small "↻ from Fri" chip. With more than 5 open tasks, a "+2 more" row appears.
     - When everything is done, the header reads "All clear" and the progress line closes, with no confetti.
6. **Below the fold (optional, a later phase):** on Sundays, a "Your week" line, e.g. "4 workouts · Bench +3% · 21 tasks done".
7. **Nav pill:** Today · Gym · School · Food. Nothing floats on the screen except the nav.

---

### Daily ritual (with seconds)

| Moment | What you do | Time |
|---|---|---|
| School morning | Open: the hero says "Leave in 14 min · 07:19 on time" (2 s). Tick or add one task (4 s). Tap water (1 s). | ~8 s |
| During the day | Tick tasks as you finish them (2 s × 3). Tap water when a bottle is done (1 s × 3–5). | ~10 s |
| After school | Open: "Next train home 14:21" (2 s). Homework set? School tab, type "math hw thu", Return (6 s). | ~8 s |
| Gym days | Gym opens on Push (1 s). Tap one pill per set (1 s × ~18). Adjust 2–3 sets with long-press (3 s each). The rest timer starts itself. Read the summary (3 s). | ~30–40 s, spread over the workout |
| Food (optional) | One quick chip (2 s), or dictate a sentence and tap "Add all" (8–10 s), about 3 meals. | ~10–30 s |
| Evening | Flip to Tomorrow and add 1–3 items (12 s). Glance at tomorrow's leave time (2 s). | ~15 s |
| Occasional | Test score prompt (5 s). Weigh-in from Gym ⋯ (5 s, weekly). | — |

**Total:** about 1 minute on a normal day and 1.5–2 minutes on a gym day, with no single visit over 30 seconds. The old app's 20 or so daily chores (8 supplement taps, sleep, mood, budget, habits, timetables) drop to zero.

---

### Design language: "Night Signal"

**Principle:** calm near-black, one coloured focal card per screen, colour only where it means something, native Apple type, and motion only in response to you or to real data.

**Colour tokens** (one shared `glance.css`):

| Role | Dark | Light |
|---|---|---|
| Background | `#0B0B0F` | `#F4F4F7` |
| Card surface | `#15151B` | `#FFFFFF` |
| Raised (inputs, sheets) | `#1D1D25` | `#ECECF1` |
| Hairline | `rgba(255,255,255,.07)` | `#E4E2DC` |
| Text / secondary / meta | `#F4F4F6` / `#A1A1AA` / `#6E6E78` | `#111114` / `#5C5C66` / `#8A8A93` |

**Area colours.** In light mode each is darkened about 12% to keep contrast.

| Area | Colour | Hex |
|---|---|---|
| To-do and brand | lavender | `#B69CFF` (carries on the current purple) |
| Gym | ember | `#FF6A3D` |
| School and commute | signal blue | `#4D8DFF` |
| Food | lime | `#A6E33B` |
| Water | aqua | `#3DD6F5` |
| Soon or delayed | amber | `#F6B84B` |
| Urgent | red | `#FF4D6D` |

Red is used only for genuinely time-critical moments ("leave now", due today, a cancelled train), never for "missed" or "not logged".

**Banned:** gradients on text, glass blur on cards (blur stays only on the nav and sheets), noise and dot overlays, drifting glows, rainbow section headers, emoji used as icons, 9–11px uppercase monospace labels, and hard-coded page colours.

**Type** (native fonts, nothing to download, so first paint is instant):
- Greetings and page titles: `ui-serif` (New York), 28–30px.
- Interface text: `system-ui` (SF Pro). Body 17px, secondary 15px, labels 13px in sentence case. **Nothing is smaller than 13px.**
- Every number: `ui-rounded` (SF Pro Rounded), weight 700, `tabular-nums`. Hero 56px, tiles 26px, set pills 17px.
- On a PC the fonts fall back to Georgia and Segoe UI.

**Shape:**
- 4pt grid, 16px gutters and card padding, 12px gaps.
- Radii: cards 22, tiles 20, sheets 24, buttons 14, pills fully rounded. Tap targets are at least 44px.
- Cards are a solid surface with a hairline. The hero is the only card with a colour wash: its area colour at 18%, fading out from the top-left corner.

**Components:**
- Hero card, tile with ring (8px round-cap stroke on a 16% track), check row (26px circle), set pill (72×48, ghost text at 40% → solid ember when logged).
- Segmented switch (32px), chips (32px), bottom sheet (grabber, Save fixed at the bottom).
- Undo toast (just above the nav, 4 s), which replaces every confirm().
- The 4-tab nav pill (64px).

**Motion.** Nothing loops, ever.

| Interaction | Motion |
|---|---|
| Press | scale to .97, 120ms |
| Checking a to-do | check draws in 220ms, strike in 200ms, row folds after a 900ms pause |
| Logging a set | pill pops (1 → 1.08 → 1, 160ms) and the rest-timer ring starts |
| Finished exercise | collapses to its result line in 240ms |
| Rings and bars | spring from the last-seen value, 600ms |
| Changed numbers | count up over 500ms, only if they changed since the last visit |
| Countdown | crossfades once a minute |
| Sheets | open in 280ms |

`prefers-reduced-motion` makes all of it instant.

**Reward model.** The reward is always in proportion to something real:
- small: a check draws itself
- medium: a ring closes, or the train shows "on time"
- big: the workout summary showing a new best

There are no points, streaks that reset, badges, or confetti.

---

### Data preservation

1. **Back up first.** Before v2.8.0 the owner runs Settings › Export my data, which saves all localStorage plus every `uid:*` row as JSON.
2. **Nothing is deleted, renamed or reshaped.** The redesign only stops showing things, adds new keys alongside old ones, and writes existing keys in their existing format.
3. **Pages are archived reversibly** with the existing `settings.pages` flags. A one-time migration with an `archiveV1` flag means a page you turn back on is never hidden again. Page files stay deployed and keep syncing, and any page can be reopened from More pages.
4. **These rows are untouched:** `uid:health` (supplements `stack:*`, sleep, photos, measurements, mealPrep), `uid:habits`, `uid:finance`, `uid:projects`, `uid:xp`, `uid:steps`, `uid:screen`. So are the tables `profiles`, `friendships`, `nudges`, `activity`, `reminders` and `push_subscriptions`, and the `ai:allowlist` key.
5. **The XP functions keep working silently** so no page breaks. They become no-op stubs only in the final cleanup. `dashboard:xp:v1` keeps its value.
6. **Old appearance fields are ignored, not erased:** `skin`, `uiStyle`, `home`, `homeStructure`, `cardStyle`, `fontSize`, `buddy`, `currency`, `weekStart`, `waterGoal`, `chrono`, `goal`. The same goes for device-only keys (`dashboard:nav:v1`, `dashboard:sections:v1`, `buddy_*`).
7. **Gym:** a logged pill writes the identical `"82.5x6"` string into `logs[date][exId].setN` / `setNR` / `setNF`, with the `nm` / `dn` stamps, so rank, History, health's composition estimate and coach.html keep parsing it. Before any legacy code is removed, check `po_coach_v1.logs` for history, and copy it in only for dates that don't already exist.
8. **Commute:** `dashboard:transport:v1` stays as it is. It is copied once into `dashboard:school:v1:commute`, which then syncs through uid:school's existing prefix and finally closes the PC↔phone gap.
9. **To-do:** past `goals:<date>` keys are kept and marked `carriedTo`, and a new `goal_days_v1 {date:{done,total}}` key is added. This only happens after the zombie-task bug has been reproduced in the live app.
10. **School:** a passed test's score becomes a normal grade linked by `testId`. Hidden form fields keep their values, and `dashboard:pomodoro:v1` is left alone.
11. **Food:** `uid:food` is unchanged apart from an optional `lastQty` on library items. The new shared profile `{sex, age, heightCm}` in uid:settings is seeded from the existing profiles without changing them.
12. **Weigh-in from Gym** merge-writes `{dateKey, weight}` into `uid:health.po_coach_weights`.
13. **Every write follows the owner's sync recipe:** `getSession()` before each push or pull, read-merge-write rather than overwrite, and `===` change markers. Every phase is checked both ways, PC→phone and phone→PC.

---

### Phased plan (one version bump each)

These rules apply to every phase:
- Bump `DASHBOARD_VERSION` (topbar.js, currently `2.7.8`) and `CACHE_VERSION` (sw.js, currently `v2.7.8`) together, and commit to main.
- Check in the live app at phone and desktop widths, with sync tested both ways.
- Every bug found from reading the source gets reproduced live before it is fixed.
- Code deletion waits until v3.0.0.

| Version | Name | What changes |
|---|---|---|
| **v2.8.0** | **Calm open (Phase 1)** | **Home:** a greeting header replaces the title, and the to-do card moves directly under it with the input on top and rows above the fold. Checking a task plays the animation and folds the task into "✓ done". The ring, gem, More fold, Polish, layout picker, mood, tiles and Coach card stop showing (keys untouched). Do Now stays for now but skips anything more than 7 days overdue and every "log X" rule. **Everywhere** (early returns and CSS in topbar.js): no XP toasts or Lv chip, no buddy, no 🧠 button, no drawer, no section arrows, no skin banner or splash, no looping animations, no version label, no friends heartbeat. **You notice:** open it and there is your list. Nothing pops up and nothing nags. |
| v2.8.1 | Now card | One query of all `<uid>:%` rows, cached for instant paint. The Now hero replaces Do Now, using the rules above. The commute part uses the existing planner (moved into a shared `commute.js`), this device's transport settings and the stored timetable, labelled "Timetable". School data comes from the cloud row; the gym's next day comes from the logs. |
| v2.8.2 | One look, four doors | `glance.css` tokens and SVG icons. A fixed 4-tab nav (Today · Gym · School · Food). Settings › More pages lists every other page; nothing is blocked yet. The water chip moves into the header (tap +1, hold for the sheet) with no XP or emoji burst. The old appearance settings are ignored. |
| v2.8.3 | Tiles | The Gym, School and Food tiles, built from the snapshot, with rings and count-ups from a last-seen cache (`glance:seen:v1`, device-only). |
| v2.8.4 | To-do that keeps its word | The Today \| Tomorrow switch absorbs Plan Tomorrow. Swipe actions, the long-press menu, Undo toasts and the "↻ from Fri" chip. Reproduce the zombie-task and dead-streak bugs live; if confirmed, keep past days, mark `carriedTo` and add `goal_days_v1`. |
| v2.8.5 | Gym opens on today | The day is auto-picked. Rank becomes a chip plus the Strength sheet. The legacy split pill, title and gear, legacy chart, coach chip and Coach Notes are hidden, and the toolbar becomes ⋯. `location.reload()` on sync is replaced by an in-place re-render (skipped while you edit a set), and the two 5-second pollers become one pull on focus. |
| v2.8.6 | Tap-to-log sets | Ghost-filled pills: a tap logs the same `WxR` string, long-press opens the steppers, and the rest timer starts on the tap. Finished exercises collapse to a result line, followed by the session summary card. Weigh-in goes into ⋯, and 1RM sparklines into the Strength sheet. **Test a whole session on the iPhone without using the keyboard.** |
| v2.8.7 | School day is one page | The commute hero moves to the top of school.html. The commute settings are copied into `dashboard:school:v1:commute`. School times are set per weekday with "off" days and "No school until…". The direction comes from the clock, and the card rolls forward after the leave time. transport.html redirects. The Pomodoro, stat chips and header card are hidden, and Subjects moves into ⋯. |
| v2.8.8 | Live trains | Fix `train-times.js` to use Asia/Jerusalem time and confirm the station IDs. Departure, platform and delay feed the hero, which falls back to the timetable with an honest label. A delay turns it amber. |
| v2.8.9 | Up next | Assignments and tests become one list. Quick-add gets its parser and preview chip, done items hide after a day, and editing uses the short sheet. Grades collapse to one row that opens a sheet. A passed test asks once for its score. |
| v2.9.0 | Food, lighter | The AI sentence box and time-ranked chips go to the top. Portions are remembered. The ring is compact, empty groups are hidden, the micronutrient tiles and sheen are gone, This Week merges into the Verdict card, and the "gaining" wording for loss goals is fixed. Targets are prefilled from the shared profile. |
| v2.9.1 | Short Settings + archive | Settings shrinks to the rows listed above, and the reminders list moves there. The one-time `archiveV1` migration hides Health, Habits, Finance, Projects, Friends and Trends from the nav, each restorable. |
| v2.9.2 | Instant and quiet | The service worker serves the app shell stale-while-revalidate for an instant cold open. The 4/5/12-second polls become pulls on focus and visibility, through one shared Supabase client. |
| v2.9.3 *(optional)* | It comes to you | One push channel: "Leave in 10 min · 07:19 on time" on school mornings, and "Test tomorrow" at 19:00. The client-side ntfy scheduler is retired, and the reminder endpoints get authentication. |
| v2.9.4 *(optional)* | How I'm trending | A Sunday "Your week" line, the grade-average change on School, and "+x% in 4 weeks" on Gym. Optional `/api/ingest?metric=weight`. |
| v3.0.0 | Cleanup | Turn the XP functions into stubs. Delete the dead code: hidden Meal Prep, Fuel Coach, the legacy gym UI, the Pomodoro HTML, the buddy, the skin/surface/home-look CSS and the timetable editors. No data keys are touched. Take a final export and run the sync check both ways on all 4 pages. |

**Rule for the future:** anything new must replace something, or live in a sheet. Today never gains a new block, and each page stays at about 1.3 screens or less.

---

## 3. Decisions only the owner can make

1. **Supplements.** Your 8-pill stack lives on the Health page, which is being tucked away. What should happen to it?
   - A) Tuck it away with Health and see if you miss it. ← **recommended**
   - B) One "Took my stack" tap on Today, morning and evening.
   - C) A reminder notification only, with no ticking.

2. **Bodyweight and strength rank.** Your gym rank and food targets need your weight. How should it get in?
   - A) Weigh in from Gym ⋯ whenever you feel like it (about 5 seconds), and rank uses the latest value. ← **recommended**
   - B) Automatically from Apple Health or a smart scale, after one Shortcut setup.
   - C) Drop strength rank and weight entirely.

3. **The "leave now" alert.** Do you want your phone to tell you when to leave on school mornings?
   - A) Yes, as a normal notification from the dashboard app: tap "Allow" once. ← **recommended**
   - B) Yes, through the separate ntfy app (install it, plus one setting on Vercel).
   - C) No, I'll just open the app.

4. **Your school week.** Which days do you go to school?
   - A) Sunday to Thursday. ← **recommended default** (you can turn any day off)
   - B) Sunday to Friday.
   - C) It varies; I'll set each day's start time myself.

5. **Getting to the station.** How should the app handle the bus leg?
   - A) Bus 74 using a fixed "about 10 minutes" estimate, with no typing. ← **recommended**
   - B) Bus 74, and I'll type its morning times once for exact timing.
   - C) I walk or get a ride, so use a fixed number of minutes.