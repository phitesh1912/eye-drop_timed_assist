// Drop Time: the rules that decide what is due, what is waiting and what was
// missed, for whichever prescription (regimens.js) the app runs.
//
// Pure functions only (no DOM, no storage) so this same file runs in the
// browser, inside the Android app's WebView, and in Node for the tests and
// the calendar export.

import { REGIMENS } from './regimens.js';

export const MIN = 60 * 1000;

export const NUMERALS = ['', '①', '②', '③', '④', '⑤'];

// The active prescription. `export let` bindings are live, so every module that
// imports COURSE / MEDS / PAIN_TABLET sees the regimen chosen at start-up.
export let REGIMEN = REGIMENS.grandma;
export let COURSE = REGIMEN.course;
export let MEDS = REGIMEN.meds;
export let PAIN_TABLET = REGIMEN.painTablet;

export function setRegimen(regimen) {
  REGIMEN = regimen;
  COURSE = regimen.course;
  MEDS = regimen.meds;
  PAIN_TABLET = regimen.painTablet;
}

// "RIGHT eye" / "Both eyes", for tags and alarm texts.
export function eyeTag() {
  return COURSE.eye === 'BOTH' ? 'Both eyes' : `${COURSE.eye} eye`;
}

export function dropTag() {
  return COURSE.eye === 'BOTH' ? '1 drop in each eye' : '1 drop';
}

export function eyeSentence() {
  return COURSE.eye === 'BOTH' ? 'Both eyes, 1 drop in each.' : `${COURSE.eye} eye only.`;
}

// ---------------------------------------------------------------- dates

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ymd(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parts(date) {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

// Local wall-clock time on a given day, as a timestamp.
export function atTime(date, hhmm) {
  const [y, m, d] = parts(date);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

function dayIndex(date) {
  const [y, m, d] = parts(date);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(date, n) {
  const [y, m, d] = parts(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function daysBetween(a, b) {
  return dayIndex(b) - dayIndex(a);
}

// Surgery day is Day 1.
export function dayNumber(date) {
  return daysBetween(COURSE.surgeryDate, date) + 1;
}

export function weekday(date, long = false) {
  const [y, m, d] = parts(date);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return long ? WEEKDAYS_LONG[w] : WEEKDAYS[w];
}

export function fmtDate(date, { weekday: wd = true } = {}) {
  const [, m, d] = parts(date);
  return `${wd ? weekday(date) + ', ' : ''}${d} ${MONTHS[m - 1]}`;
}

export function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtClock(ms) {
  const d = new Date(ms);
  return fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

export function hhmmOf(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / MIN));
  if (totalMin < 1) return 'less than a minute';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

// ---------------------------------------------------------------- medicines

export function label(med) {
  return med.num ? `${NUMERALS[med.num]} ${med.name}` : med.name;
}

// A short name for small chips: "Chymoral Forte" -> "Chymoral", "Vitamin tablet" -> "Vitamin".
export function shortName(med) {
  return med.short || med.name.replace(/ tablet$/i, '');
}

export function originalEnd(medId) {
  const med = MEDS.find((m) => m.id === medId);
  return med.phases[med.phases.length - 1].to;
}

// Applies the family's settings (changed end dates, tablet time) to the sheet.
export function effectiveMeds(settings = {}) {
  const ends = settings.endOverrides || {};
  return MEDS.map((m) => {
    let phases = m.phases.map((p) => ({ ...p, times: [...p.times] }));
    if (m.id === REGIMEN.adjustableTime && settings.vitaminTime) {
      phases = phases.map((p) => ({ ...p, times: [settings.vitaminTime] }));
    }
    const end = ends[m.id];
    if (end) {
      phases = phases.filter((p) => p.from <= end);
      if (phases.length) phases[phases.length - 1].to = end;
    }
    return { ...m, phases };
  });
}

export function courseBounds(meds) {
  let first = null;
  let last = null;
  for (const m of meds) {
    for (const p of m.phases) {
      if (!first || p.from < first) first = p.from;
      if (!last || p.to > last) last = p.to;
    }
  }
  return { first: first || COURSE.startDate, last: last || COURSE.startDate };
}

export function medEnd(med) {
  return med.phases.length ? med.phases[med.phases.length - 1].to : null;
}

export function medStart(med) {
  return med.phases.length ? med.phases[0].from : null;
}

export function timesPerDayText(n) {
  if (n === 1) return 'once a day';
  if (n === 2) return 'twice a day';
  return `${n} times a day`;
}

export function mealFor(hhmm, med) {
  if (med && med.note) return med.note;
  const h = Number(hhmm.split(':')[0]);
  if (h < 11) return 'after breakfast';
  if (h < 17) return 'after lunch';
  return 'after dinner';
}

// ---------------------------------------------------------------- doses

export function doseId(date, medId, time) {
  return `${date}|${medId}|${time}`;
}

export function parseDoseId(id) {
  const [date, medId, time] = id.split('|');
  return { date, medId, time };
}

export function dosesForDate(date, meds) {
  const out = [];
  for (const m of meds) {
    for (const p of m.phases) {
      if (date < p.from || date > p.to) continue;
      for (const t of p.times) {
        out.push({ id: doseId(date, m.id, t), date, time: t, at: atTime(date, t), med: m });
      }
    }
  }
  out.sort((a, b) => a.at - b.at || a.med.order - b.med.order);
  return out;
}

function timing(delayMin, onTimeMin) {
  if (delayMin > onTimeMin) return 'late';
  if (delayMin < -onTimeMin) return 'early';
  return 'ontime';
}

// Most recent time any eye drop was put (used for the 5-minute gap rule).
export function lastDropAt(records, now) {
  let last = 0;
  for (const [id, r] of Object.entries(records)) {
    if (r.s !== 'done' || r.at > now) continue;
    if (!parseDoseId(id).medId.startsWith('d')) continue;
    if (r.at > last) last = r.at;
  }
  return last;
}

// Status of every dose on one day at time `now`:
//   done      put (with timing ontime / late / early)
//   skipped   deliberately skipped
//   missed    not put before the next dose of the same medicine (or midnight)
//   due       put this one now
//   gap       due, but wait until `waitUntil` (5 minutes after the last drop)
//   queued    due, but another drop goes first
//   upcoming  later
// Doses before `trackFrom` (when the app was set up) are left out entirely.
export function evaluateDay(date, ctx) {
  const { now, meds, records = {}, snoozes = {}, gapMin = 5, onTimeMin = 30, trackFrom = 0 } = ctx;
  const doses = dosesForDate(date, meds);
  const dayEnd = atTime(addDays(date, 1), '00:00');

  doses.forEach((d, i) => {
    const next = doses.slice(i + 1).find((x) => x.med.id === d.med.id);
    d.cutoff = next ? next.at : dayEnd;
  });

  const gapUntil = (() => {
    const last = lastDropAt(records, now);
    return last ? last + gapMin * MIN : 0;
  })();

  const pendingDrops = [];
  for (const d of doses) {
    const r = records[d.id];
    if (r && r.s === 'done') {
      d.status = 'done';
      d.doneAt = r.at;
      d.by = r.by || '';
      d.delayMin = Math.round((r.at - d.at) / MIN);
      d.timing = timing(d.delayMin, onTimeMin);
      continue;
    }
    if (r && r.s === 'skipped') {
      d.status = 'skipped';
      d.doneAt = r.at;
      d.by = r.by || '';
      continue;
    }
    if (d.at < trackFrom) { d.status = 'untracked'; continue; }
    if (now >= d.cutoff) { d.status = 'missed'; continue; }
    if (now < d.at) { d.status = 'upcoming'; continue; }
    d.lateMin = Math.floor((now - d.at) / MIN);
    if (d.med.kind === 'drop') pendingDrops.push(d);
    else d.status = 'due';
  }

  pendingDrops.sort((a, b) => a.at - b.at || a.med.order - b.med.order);
  pendingDrops.forEach((d, i) => {
    if (i > 0) { d.status = 'queued'; return; }
    if (now < gapUntil) { d.status = 'gap'; d.waitUntil = gapUntil; }
    else d.status = 'due';
  });

  for (const d of doses) {
    const s = snoozes[d.id];
    if (s && s > now && ['due', 'gap', 'queued'].includes(d.status)) d.snoozedUntil = s;
  }
  return doses.filter((d) => d.status !== 'untracked');
}

export const OPEN_STATUSES = ['due', 'gap', 'queued'];

// One day's totals for the records screen.
export function summarizeDay(date, ctx) {
  const doses = evaluateDay(date, ctx);
  const today = ymd(ctx.now);
  const s = {
    date, day: dayNumber(date), doses,
    total: doses.length,
    drops: doses.filter((d) => d.med.kind === 'drop').length,
    done: 0, ontime: 0, late: 0, early: 0, missed: 0, skipped: 0, open: 0, upcoming: 0,
  };
  for (const d of doses) {
    if (d.status === 'done') {
      s.done++;
      s[d.timing]++;
    } else if (d.status === 'missed') s.missed++;
    else if (d.status === 'skipped') s.skipped++;
    else if (d.status === 'upcoming') s.upcoming++;
    else s.open++;
  }
  if (!s.total) s.status = 'none';
  else if (date > today) s.status = 'future';
  else if (s.missed > 0) s.status = 'missed';
  else if (s.open > 0 || s.upcoming > 0) s.status = 'progress';
  else if (s.late > 0 || s.skipped > 0 || s.early > 0) s.status = 'late';
  else s.status = 'perfect';
  return s;
}

// ---------------------------------------------------------------- alarms

function ringText(doses, slotTime, nag, gapMin) {
  const drops = doses.filter((d) => d.med.kind === 'drop');
  const when = fmtTime(slotTime);
  if (drops.length) {
    const names = drops.map((d) => label(d.med)).join(`, wait ${gapMin} min, then `);
    return {
      title: nag ? `Reminder: ${when} eye drops not ticked yet` : `Eye drops time · ${when}`,
      text: `${names}. ${eyeSentence()}`,
    };
  }
  const t = doses[0];
  return {
    title: nag ? `Reminder: ${when} ${t.med.name.toLowerCase()} not ticked yet` : `${t.med.name} · ${when}`,
    text: `1 tablet ${mealFor(slotTime, t.med)}.`,
  };
}

const LIVE = ['upcoming', ...OPEN_STATUSES];

// Every alarm from `fromDate` to `toDate` (inclusive): one per time slot, plus
// repeat reminders while the slot is still not ticked. A slot moves later when
// the 5-minute gap or a snooze says so. Includes past alarms of today; callers
// filter by time as needed.
export function ringPlan(ctx, fromDate, toDate) {
  const { now, nagMins = [10, 20], gapMin = 5 } = ctx;
  const last = lastDropAt(ctx.records || {}, now);
  const gapUntil = last ? last + gapMin * MIN : 0;
  const offsets = [0, ...nagMins];
  const out = [];

  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    const doses = evaluateDay(date, ctx);
    const slots = new Map();
    for (const d of doses) {
      const key = d.med.kind === 'drop' ? `drop@${d.time}` : `${d.med.id}@${d.time}`;
      if (!slots.has(key)) slots.set(key, []);
      slots.get(key).push(d);
    }

    const planned = [];
    for (const slot of slots.values()) {
      const live = slot.filter((d) => LIVE.includes(d.status));
      if (!live.length) continue;
      const isDrop = live[0].med.kind === 'drop';
      let base = live[0].at;
      for (const d of live) base = Math.max(base, d.waitUntil || 0, d.snoozedUntil || 0);
      if (isDrop) base = Math.max(base, gapUntil);
      const cutoff = Math.min(...live.map((d) => d.cutoff));
      planned.push({ live, isDrop, base, cutoff });
    }
    planned.sort((a, b) => a.base - b.base);

    planned.forEach(({ live, isDrop, base, cutoff }, idx) => {
      // The next slot's alarm is the reminder: no repeats within 2 minutes of it.
      const next = planned.slice(idx + 1).find((p) => p.base > base);
      const stopAt = next ? next.base - 2 * MIN : Infinity;
      offsets.forEach((off, i) => {
        const at = base + off * MIN;
        if (at >= cutoff || (i > 0 && at > stopAt)) return;
        // Drops already overdue from earlier slots go first in the message.
        const list = isDrop
          ? [...doses.filter((d) => d.med.kind === 'drop' && OPEN_STATUSES.includes(d.status) && d.at < live[0].at), ...live]
          : live;
        const { title, text } = ringText(list, live[0].time, i > 0, gapMin);
        out.push({ at, key: `${live[0].id}@${at}`, ids: live.map((d) => d.id), nag: i, title, text });
      });
    });
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

// The alarm that should be ringing now (or null): the latest one that started
// within the last `ringMinutes` and hasn't been silenced.
export function activeRing(ctx, acks = {}, ringMinutes = 10) {
  const today = ymd(ctx.now);
  const plan = ringPlan(ctx, today, today);
  let current = null;
  for (const r of plan) {
    if (r.at <= ctx.now && ctx.now < r.at + ringMinutes * MIN && !acks[r.key]) current = r;
  }
  return current;
}

// ---------------------------------------------------------------- overview

// Days on which a medicine starts, stops or changes how often it is used.
export function scheduleChanges(meds) {
  const { first, last } = courseBounds(meds);
  const out = [];
  let prev = {};
  for (let date = first; date <= addDays(last, 1); date = addDays(date, 1)) {
    const cur = {};
    for (const d of dosesForDate(date, meds)) (cur[d.med.id] ||= []).push(d.time);
    const items = [];
    for (const m of meds) {
      const a = prev[m.id];
      const b = cur[m.id];
      if (!a && b) items.push({ med: m, type: 'start', times: b });
      else if (a && !b) items.push({ med: m, type: 'stop' });
      else if (a && b && a.join() !== b.join()) items.push({ med: m, type: 'change', times: b, before: a });
    }
    if (items.length) out.push({ date, items });
    prev = cur;
  }
  return out;
}

// Distinct alarm times on a day, e.g. for setting phone Clock alarms.
export function slotTimes(date, meds) {
  return [...new Set(dosesForDate(date, meds).map((d) => d.time))];
}
