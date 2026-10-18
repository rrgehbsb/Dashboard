**Owner's-advocate corrections to the "Glance" plan**

I checked three things in the source and live. First, `runRollover` in `dashboard/index.html` (lines 1309–1323) carries every unfinished goal from every past date into today, with no age limit. Second, the water pill in `dashboard/topbar.js` (lines 431–440) turns amber below 50% and pulses red after 18:00. Third, I probed the train endpoint from the owner's own PC: `www.rail.co.il/apiinfo/...` returned HTTP 403 and an HTML bot-capture page instead of JSON.

**A. Order and scope: Phase 1 is not the fastest way to "I want to open this"**

1. **Add a Phase 0 to test the design first.**
   - Design was half of why the owner quit, but the 9/10 score for "eye-pulling" is the designers' guess.
   - Before any code, build a static clickable mock of the 4 screens with realistic data, at phone (390px) and desktop widths, in 2 visual variants. The owner picks one.
   - Also ask whether their iPhone runs in light or dark mode. Polish that mode first and add the other one later. "System" would otherwise show them the less-polished mode first.
2. **Move "remove" into v2.8.0.**
   - The owner's first ask was "remove here and there", but the archive arrives at v2.9.1 and the 4-tab nav at v2.8.2.
   - The archive is just a few `settings.pages` flags. The fixed nav and the `glance.css` tokens on Today are also cheap.
   - Ship all three in Phase 1. Otherwise Phase 1 looks like the same old app with less on it.
3. **Hide Do Now in v2.8.0.** It reads school data from localStorage, which the inventory suspects is stale or empty (not yet verified). It could headline nonsense right above the to-do list. Ship the Now hero in the same release or the next one.
4. **Bring "instant open" forward.** Stale-while-revalidate for the app shell plus the cached snapshot is set for v2.9.2, but "see something useful in 1 second" is the whole reward model. Put it in Phase 1.
5. **Cut 15 releases down to about 5 visible milestones:** Shell + Today, then Gym, then School day (commute sync, trains, Up next), then Food, then Cleanup. Fifteen bumps, each needing a two-way sync check, is itself a long slog for an owner who is already lost.
6. **Fix the commute order.**
   - School + Transport is core #2, yet it lands at v2.8.7–2.8.9.
   - The v2.8.1 hero uses each device's own transport settings, so the PC and the phone will show different leave times.
   - Copy the settings into `dashboard:school:v1:commute` before, or together with, the hero.

**B. The first open after months away is never designed, and it will feel like a duty straight away**

7. **To-do list:** after months away, the rollover dumps every old unfinished task into today, each with a "↻ from Jun 9" chip. Collapse anything carried for more than 7 days into one row: "N old tasks · Keep / Clear all" (with Undo).
8. **School:**
   - Assignments from June that were never marked done will top the Up next list.
   - "A passed test asks once for its score" would fire for every test since June.
   - Change: items more than 14 days overdue move silently to "Old" (one tap clears them). Only ask for scores on tests from the last 7 days.
   - Ask with a "+ score" chip on the row that disappears after 3 days, never a prompt. The plan itself promises no pop-ups.
9. **Gym:**
   - After a long break, Fill will prescribe "Add weight" from a session months ago, and the summary will show something like "−40% volume vs last".
   - Change: if the last session of that day was more than 21 days ago, prescribe the last weight (or 10% less) labelled "back to it".
   - The summary should only compare against sessions from the last 21 days. Otherwise it says "Baseline set".

**C. Game and duty leftovers that contradict the plan's own rules**

10. **The "Gold II" tier chip with LP and "closest rank-up" is XP grind under another name.**
    - Without a bodyweight it shows "Log my weight", which is a "log X" prompt in the gym header.
    - Change: remove the tier from the header. The reward should be honest PRs and estimated 1RM in the session summary and History.
    - Strength rank then no longer needs weigh-ins.
11. **Drop the "dead streak" fix,** since streaks are banned. Add `goal_days_v1` only if the Sunday line ships. Reproduce the zombie-task bug in Phase 1, not v2.8.4, because the to-do list becomes the main thing on screen.
12. **Spell out the water chip rules:**
    - no status colour, no amber or red pulse, no "behind pace" (this removes the topbar.js 431–440 behaviour)
    - the hold sheet holds only Undo and bottle size
    - drop the 7-day strip
    - remove the duplicate "Water bottle size" row from Settings
13. **Hero rule 5 nudges the gym every day.** "Next: Push · Bench 82.5×6" on every afternoon or day off without a workout amounts to a daily "go to the gym". Show it only when there has been at least one rest day since the last session and today is one of the owner's usual gym weekdays (from the logs). Otherwise fall through to rule 7.
14. **Food:**
    - Hide the Verdict card entirely until it has enough data (no "log 2 more days").
    - Hide the Food tile on days with no entries; "2,400 left" at 21:00 is guilt about not logging.
15. **Rewrite the "Daily ritual" table.** Only the to-do list is a routine. Water taps and evening planning should be marked optional and never prompted.

**D. Still too much, or kept only because it was already built**

16. **The tiles repeat the hero,** the same flaw the plan held against A: "Math test Tue" in the hero next to "Bio test Tue" on the School tile, and the Next-workout hero next to the Gym tile. Rule: a tile never repeats the hero's area. If it has nothing else to add, it hides, which gives the to-do list another row.
17. **Food "More ways":**
    - Barcode is hidden on iOS and PCs have no camera, so cut it.
    - The recipe builder is niche and the AI sentence covers it, so cut it. Keep search and quick add.
    - Fix the plan's contradiction: the page structure puts the ring above "What did you eat?", while v2.9.0 puts the input on top. Put the input and chips first, with the ring right under them.
18. **Settings:**
    - "Show in nav" contradicts the 4 fixed tabs and reopens the nav sprawl. More pages should only offer Open.
    - The reminders list moved into Settings has no working delivery: NTFY_TOPIC is unset and there are two schedulers. Archive it until the single push channel exists.
19. **Commute sheet:** drop the comma-separated fallback timetable editor, the exact chore being removed. Show the stored defaults read-only, labelled with their date.
20. **School:**
    - Show "Grades · avg" only when grades exist.
    - Quick-add should match the 26 seeded subjects (fuzzy) before creating new ones, so typos don't create junk subjects.
    - Fold the Gym Strength sheet into History rather than adding another sheet.

**E. Commute correctness (core #2)**

21. **Live trains may not be reachable, so test that first.**
    - `api/train-times.js` calls the old `www.rail.co.il/apiinfo/api/Plan/GetRoutes`.
    - From the owner's PC today, GetStations returned 403 and an HTML bot page.
    - The defaults `2300`/`8600` look like Haifa Hof HaCarmel → Ben Gurion Airport (from memory, not checked), not Rosh HaAyin North → Herzliya.
    - Change: a one-hour test in Phase 0/1 to find a source that works (the newer rail API host with its key, or GTFS) before any hero text says "Live · plat 2 · on time".
    - Until then, design the hero to say "Timetable" honestly.
22. **Use proper time zone handling.** Use `Intl` with Asia/Jerusalem, not a hard-coded +3: Israel's clocks go back on Oct 25, a week from now. Test across that change.
23. **Make the hero text match decision 5's default.**
    - The mock shows "Bus 74 06:58", but the recommended "fixed ~10 min" option has no bus times. The text should read "Leave 06:44 · train 07:19".
    - The stored timetable is a single weekday list from June 2026. If Friday is a school day, Friday trains differ, so show "Friday times may differ" unless live data works.

**F. Speed**

24. **Don't load all `<uid>:%` rows on Today.**
    - The `uid:health` row embeds every progress photo as base64 (about 100–200KB each), which would break the 1-second open on mobile data.
    - Fetch only the rows Today needs, and from health only `po_water_v1` and `po_coach_weights`, by key or JSON path.

**G. Gaps and things the owner might miss**

25. **Define a desktop layout.** The plan only specifies 390×844, but the owner uses the PC too, and their rule is to check both widths. For example, Today in two columns: hero and tiles on one side, to-do on the other. On Windows, `ui-serif` and `ui-rounded` fall back to Georgia and Segoe, which are not rounded. Either cache one number font or test the fallback deliberately.
26. **Tell the owner what keeps running in the background.**
    - The app-usage Shortcuts automations make the tracked apps (e.g. TikTok) open slower, and their data will now show nowhere. Suggest deleting them; the steps automation can stay.
    - The archive step should list by name what goes out of sight with zero input cost: the step count, subscription renewal reminders, and open Projects tasks. Offer a one-time import of open Projects tasks into the to-do list, since those are to-dos and the owner likes the to-do list.
27. **Ask fewer questions.** Five decisions is too many for someone who is lost. Use the recommended defaults for supplements, bodyweight and the alert. Only ask about school days and how they get to the station, because those change the leave time, plus the design pick and light/dark question from Phase 0.