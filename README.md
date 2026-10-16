# Drop Time 💧

Eye drop reminders and records that follow the hospital's post-op sheet. The app rings at every drop time,
shows which bottle to use, times the 5-minute gap between drops, and records who put each drop and when.

There are two apps, one per prescription, and each keeps its own records:

| App | For | Link (after hosting, see below) |
| --- | --- | --- |
| **Drop Time** | Grandma: cataract surgery on the right eye, 7 Oct 2026 | [GitHub Pages](https://phitesh1912.github.io/eye-drop_timed_assist/docs/) or `<Vercel site>/`, and an Android app |
| **Drop Time+** | Brother: C/PRK laser surgery on both eyes, 16 Oct 2026 | [GitHub Pages](https://phitesh1912.github.io/eye-drop_timed_assist/docs/brother/) or `<Vercel site>/brother/` (made for iPhone, dark modern design) |

- **Android phones:** Drop Time is a real app. The phone's alarm system rings it, even when the app is closed or the phone is locked.
- **iPhones:** both apps work as web apps on the Home Screen. They ring while they're open on screen,
  and you can add every drop time to the iPhone Calendar as backup alerts.

## Install on Android

1. On the Android phone, open
   **https://github.com/phitesh1912/eye-drop_timed_assist/releases/latest/download/DropTime.apk**
2. Open the downloaded file and tap **Install**. Android asks once to allow installs from the browser or
   Files app. If it warns that the app isn't from the Play Store, tap **Install anyway**.
3. Open **Drop Time**, add the family names and tap **Allow alarms**.
4. Go to **Settings → Alarm setup**. Fix anything that has a yellow mark, then press **Test alarm in 1 min**,
   lock the phone and wait. It should ring.

On Redmi, Xiaomi, POCO, Oppo, Realme, Vivo and OnePlus phones, also turn on **Autostart** and set the battery saver
to **No restrictions** for Drop Time. The Settings screen shows the tip for the phone you have.

A new version installs over the old one and keeps the records.

## Install on iPhone

The web apps are the `docs/` folder (Drop Time) and `docs/brother/` (Drop Time+). Host it once, either way:

- **Vercel (easiest):** on [vercel.com](https://vercel.com) sign in with GitHub, choose **Add New → Project**, import
  `eye-drop_timed_assist` and press **Deploy**. `vercel.json` already tells Vercel to serve `docs/` with no build step.
  You get a link like `https://eye-drop-timed-assist.vercel.app`, and every push updates it.
- **Or GitHub Pages (already on for this repository):** **Settings → Pages** publishes the branch
  `claude/eye-drops-reminder-app-65ukaj` from **/ (root)**, so the apps are at
  **https://phitesh1912.github.io/eye-drop_timed_assist/docs/** (Drop Time) and
  **https://phitesh1912.github.io/eye-drop_timed_assist/docs/brother/** (Drop Time+).
  Keep that setting as it is: a Home Screen app on an iPhone keeps its records under its own link.

On the iPhone (use the `/brother/` link for Drop Time+):

1. Open that link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Always open **Drop Time** from the new Home Screen icon. Records made in a Safari tab stay in that tab.
4. In Settings tap **Play sound**, then **Test** next to *Test the alarm*. With the app open on screen it rings a minute later.
   iPhones only allow sound after the screen has been touched once, and they don't let web apps vibrate.
5. Optional backup: **Schedule → Add all drop times to the phone calendar**, then tap **Add All**.
   Calendar alerts ring even when the app is closed, but not when the silent switch is on.

The web app can only ring while it's open on screen. For the strongest setup, keep one phone or tablet near Grandma,
on charge, with the app open and **Keep the screen on** switched on. The Android app doesn't need any of this.

## Drop Time+ (the brother's app)

Made for iPhone, with a dark, low-glare design (eyes are sensitive to light after PRK). It works the same way as
Drop Time, plus a strip of today's drop times at the top of the Today screen.

1. In **Safari** open **https://phitesh1912.github.io/eye-drop_timed_assist/docs/brother/** (or `<Vercel site>/brother/`),
   tap **Share → Add to Home Screen → Add**.
2. Open **Drop Time+** from the Home Screen icon and type the name. With one name, **Done** ticks in one tap.
3. Tap **Add to iPhone Calendar**, then **Add All**. These alerts ring even when the app is closed
   (not when the silent switch is on).
4. In Settings tap **Play sound**, then **Test** next to *Test the alarm*, and keep the app open: it rings a minute later.

Day 1 = surgery day, Fri 16 Oct 2026. Both eyes, 1 drop in each eye. On day 1 the app counts drops from the time
it was set up (minus an hour), so drops from before the app existed aren't marked missed.

| Box | Drop / tablet | Times | Dates |
| --- | --- | --- | --- |
| ① | Lotefast (loteprednol 0.5%), shake well | Month 1: 7:30, 11:30 AM · 3:30, 7:30 PM · Month 2: 7:30 AM, 7:30 PM · Month 3: 7:30 AM | 16 Oct – 15 Jan |
| ② | Moxicip (moxifloxacin) | 7, 10 AM · 1, 4, 7, 10 PM | 1 week, 16 – 22 Oct |
| ③ | Aquim PF (lubricant) | Month 1: every hour 7:15 AM – 6:15 PM (12 a day) · Months 2–3: 7, 9, 11 AM · 1, 3, 5 PM | 16 Oct – 15 Jan |
| ④ | Micronac PF (nepafenac), shake well | 8 AM · 2 PM · 8 PM | 3 days, 16 – 18 Oct |
| 💊 | Eye 360 (instead of Osmega) | 1:30 PM, after lunch | 30 tablets, 16 Oct – 14 Nov |
| 💊 | Chymoral Forte | 9 AM · 9 PM, after food | 3 days, 16 – 18 Oct |
| 💊 | Pain tablet (Dolo 650 / Combiflam) | only if there is pain, max 2 a day | as needed |

Assumptions to check with the doctor (end dates and the Eye 360 time can be changed in Settings):

- Months are counted from surgery day: month 1 is 16 Oct – 15 Nov, month 2 is 16 Nov – 15 Dec, month 3 is 16 Dec – 15 Jan.
- GenTeal gel is crossed out on the sheet, so it isn't scheduled. The eye wipes aren't on the sheet either.

Drops per day: 25 (16–18 Oct) → 22 (until 22 Oct) → 16 (until 15 Nov) → 8 (until 15 Dec) → 7 (until 15 Jan).

## Using it

| Part of the screen | What it means |
| --- | --- |
| 🔔 **Put now** | Due now. Big card with the bottle number, box colour, which eye, *shake well* if needed. Tap **Done**, then tap who put it (with only one name, **Done** ticks straight away). |
| ⏳ **Wait** | Two drops at the same time (for example 8:00 AM: ③ then ⑤). After the first, a 5-minute timer runs and the alarm rings again for the second. |
| 🕒 **Coming up** | The rest of today, with a countdown to the next one. |
| ✅ **Done** | What was put, at what time, by whom, and whether it was on time (within 30 min). Tap one to undo or correct it. |

- **Alarm:** rings at each time. If nobody ticks it, it reminds again after 10 and 20 minutes. **Remind in 5 min** snoozes it.
- **Missed:** if a drop isn't ticked before the next dose of the same drop is due (or by midnight), it's marked missed so nobody doubles up.
  If it was actually put, tap it and choose **It was put. Tick it**.
- **Pain tablet** (Dolo 650 / Ultracet for Grandma, Dolo 650 / Combiflam for Drop Time+): only if there is pain. Log it with **Gave a pain tablet**, at most 2 a day.
- **Records:** day by day, for example *"Thu, 8 Oct · Day 2 · All on time"*. You can share today's report to WhatsApp,
  save a spreadsheet (CSV) for the doctor, or make a backup.
- **If the doctor changes the plan:** in Settings, change when a medicine ends, or the vitamin (Eye 360) time.

Each phone keeps its own records. If several people tick drops on different phones, the phones don't see each other's ticks yet,
so pick one main phone for ticking.

## Grandma's schedule (from the hospital sheet)

Day 1 = surgery day, Wed 7 Oct 2026. The app starts Thu 8 Oct (Day 2), first drop at 7:00 AM. Right eye only.

| Box | Drop | Times | Dates |
| --- | --- | --- | --- |
| ② | Moxicip D (moxifloxacin + dexamethasone) | 7, 10 AM · 1, 4, 7, 10 PM | 8 – 13 Oct (handwritten "till 13th Oct") |
| ① | Pred Forte (prednisolone acetate), shake well | 14–20 Oct: 7:00, 11:00, 2:30, 5:00, 9:00 · 21–27 Oct: 7:00, 12:00 noon, 5:00, 9:00 · 28 Oct–3 Nov: 7:00, 4:00, 9:00 · 4–10 Nov: 7 AM, 7 PM · 11–17 Nov: 7 AM | 14 Oct – 17 Nov |
| ③ | Micronac PF (nepafenac), shake well | 8 AM · 2 PM · 9 PM | 45 days, till 20 Nov |
| ④ | Dortas (dorzolamide) | 7:30 AM · 2:30 PM · 9:30 PM | 2 weeks, till 20 Oct |
| ⑤ | Trehalube (sodium hyaluronate) | 8 AM · 12, 4, 8 PM | 1 month, till 6 Nov |
| 💊 | Vitamin (I-FIT-M / Eye 360 / Nusight) | 9 AM, after breakfast | 1 month, till 6 Nov |
| 💊 | Pain tablet (Dolo 650 / Ultracet) | only if there is pain, max 2 a day | as needed |

Assumptions to check with the doctor (all can be changed in Settings):

- "2 weeks", "45 days" and "1 month" are counted from surgery day, the same way the sheet counts the Pred Forte weeks.
- The sheet prints "12:00 AM" for week 3 of Pred Forte. That is read as 12:00 noon.
- When two drops are due together, the lower box number goes first, so the lubricant ⑤ is always last, with 5 minutes in between.

Drops per day: 16 (8–13 Oct) → 15 → 11 → 10 → 9 → 5 → 4 → 3 (18–20 Nov).

## Privacy

All records stay on the phone (browser storage on iPhone, app storage on Android) until you save a backup.
This repository is public, so the code contains no names or hospital record numbers. The patient's name and the family's
names are typed in the app and stay on the phone.

## For developers

```
docs/                 Drop Time, the web app (also served by GitHub Pages and bundled into the Android app)
  brother/            Drop Time+: its own page, manifest, icons, calendar file and offline cache; same code
  js/regimens.js      both prescriptions (medicines, times, dates, hospital number)
  js/schedule.js      all timing rules (pure functions), for whichever prescription the page picks
  js/app.js           start-up, clock, alarms, button handling
  css/modern.css      the dark Drop Time+ design, on top of css/app.css
  js/view-*.js        Today / Records / Schedule / Settings screens
  js/sheets.js        pop-up sheets and the full-screen alarm
  js/ics.js           calendar export
android/              Android shell: WebView + native alarms
  .../AlarmScheduler  keeps the alarm list, books the next one with AlarmManager.setAlarmClock
  .../Notifier        full-screen notification on the alarm sound stream, repeats until stopped
  .../BootReceiver    books alarms again after a restart or a clock change
tests/                schedule tests (npm test)
tools/                calendar and asset generators
```

- `npm test` runs the schedule tests in India time (no dependencies to install).
- A page picks its prescription with `<html data-regimen="brother">`. Each prescription has its own storage key,
  so the two apps never mix records, even on the same phone.
- `npm run build:ics` regenerates `docs/calendar/drop-time.ics` and `docs/brother/calendar/drop-time.ics`. `python3 tools/make-assets.py` regenerates the icons and the alarm sound.
  GitHub Actions runs both on every build, decodes the signing key from `android/keystore/droptime-release.jks.b64`,
  and commits anything new back to the branch, so the repository itself only needs text files.
- Build the APK yourself with Gradle 8.10.2 and JDK 17: `gradle -p android assembleRelease`.
- Every push that touches `android/`, `docs/` or `tools/` builds the APK on GitHub Actions and publishes it as the latest release.
- The web app gives the Android app the whole list of alarms (`window.DropTimeAndroid.setAlarms`). After every tick it sends
  a new list, so the reminders for ticked drops disappear.
- The APK signing key (`android/keystore`) is committed on purpose, so every build installs over the previous one without
  losing records. It is only for this family app. Don't reuse it.
