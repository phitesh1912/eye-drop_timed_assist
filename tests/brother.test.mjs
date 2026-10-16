// The brother's PRK plan (both eyes, surgery 16 Oct 2026). Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIMENS } from '../docs/js/regimens.js';
import {
  MIN, setRegimen, atTime, addDays, dayNumber, fmtDate, effectiveMeds, dosesForDate, evaluateDay,
  ringPlan, activeRing, scheduleChanges, courseBounds, summarizeDay, eyeTag, dropTag,
} from '../docs/js/schedule.js';

setRegimen(REGIMENS.brother);
const meds = effectiveMeds({});
const drops = (date) => dosesForDate(date, meds).filter((d) => d.med.kind === 'drop');
const tablets = (date) => dosesForDate(date, meds).filter((d) => d.med.kind === 'tablet');
const ctx = (now, extra = {}) => ({ now, meds, records: {}, snoozes: {}, gapMin: 5, onTimeMin: 30, nagMins: [10, 20], ...extra });

test('surgery day is Day 1 and the course runs three months', () => {
  assert.equal(dayNumber('2026-10-16'), 1);
  assert.deepEqual(courseBounds(meds), { first: '2026-10-16', last: '2027-01-15' });
  assert.equal(fmtDate('2027-01-15'), 'Fri, 15 Jan');
  assert.equal(eyeTag(), 'Both eyes');
  assert.equal(dropTag(), '1 drop in each eye');
});

test('first three days: 25 drops, every one at its own time', () => {
  const d = drops('2026-10-16');
  assert.equal(d.length, 25);
  assert.equal(new Set(d.map((x) => x.time)).size, 25);
  assert.deepEqual(d.slice(0, 6).map((x) => `${x.time} ${x.med.name}`), [
    '07:00 Moxicip', '07:15 Aquim PF', '07:30 Lotefast', '08:00 Micronac PF', '08:15 Aquim PF', '09:15 Aquim PF',
  ]);
  assert.equal(d.at(-1).time, '22:00');
  assert.deepEqual(tablets('2026-10-16').map((x) => `${x.time} ${x.med.name}`), ['09:00 Chymoral Forte', '13:30 Eye 360', '21:00 Chymoral Forte']);
});

test('drops per day as each medicine finishes or steps down', () => {
  assert.equal(drops('2026-10-18').length, 25);
  assert.equal(drops('2026-10-19').length, 22); // Micronac PF done after 3 days
  assert.equal(drops('2026-10-22').length, 22);
  assert.equal(drops('2026-10-23').length, 16); // Moxicip done after 1 week
  assert.equal(drops('2026-11-15').length, 16);
  assert.equal(drops('2026-11-16').length, 8); // month 2: Lotefast 2x, Aquim 6x
  assert.equal(drops('2026-12-15').length, 8);
  assert.equal(drops('2026-12-16').length, 7); // month 3: Lotefast 1x
  assert.equal(drops('2027-01-15').length, 7);
  assert.equal(drops('2027-01-16').length, 0);
  assert.equal(tablets('2026-10-19').length, 1); // Chymoral Forte done after 3 days
  assert.equal(tablets('2026-11-14').length, 1);
  assert.equal(tablets('2026-11-15').length, 0); // Eye 360: one box of 30
});

test('month 2 and month 3 changes are listed', () => {
  const changes = scheduleChanges(meds);
  const nov16 = changes.find((c) => c.date === '2026-11-16');
  assert.ok(nov16.items.some((i) => i.med.id === 'd1' && i.type === 'change' && i.times.length === 2));
  assert.ok(nov16.items.some((i) => i.med.id === 'd3' && i.type === 'change' && i.times.length === 6));
  const dec16 = changes.find((c) => c.date === '2026-12-16');
  assert.ok(dec16.items.some((i) => i.med.id === 'd1' && i.times.length === 1));
});

test('opened at 4:30 PM on surgery day: earlier doses are not counted as missed', () => {
  const now = atTime('2026-10-16', '16:30');
  const doses = evaluateDay('2026-10-16', ctx(now, { trackFrom: now - 60 * MIN }));
  assert.ok(!doses.some((d) => d.time < '15:30'));
  assert.ok(!doses.some((d) => d.status === 'missed'));
  const open = doses.filter((d) => ['due', 'gap', 'queued'].includes(d.status)).map((d) => `${d.time} ${d.med.name}`);
  assert.deepEqual(open, ['15:30 Lotefast', '16:00 Moxicip', '16:15 Aquim PF']);
  const s = summarizeDay('2026-10-16', ctx(now, { trackFrom: now - 60 * MIN }));
  assert.equal(s.missed, 0);
  assert.equal(s.drops, 9); // 15:30 onwards: 15:30, 16:00, 16:15, 17:15, 18:15, 19:00, 19:30, 20:00, 22:00
});

test('alarms say both eyes, tablets say when to take them', () => {
  const now = atTime('2026-10-16', '20:30');
  const plan = ringPlan(ctx(now, { trackFrom: now }), '2026-10-16', '2026-10-17');
  const chymoral = plan.find((r) => r.at === atTime('2026-10-16', '21:00'));
  assert.equal(chymoral.text, '1 tablet after food.');
  const moxi = plan.find((r) => r.at === atTime('2026-10-16', '22:00'));
  assert.match(moxi.text, /② Moxicip\. Both eyes, 1 drop in each\./);
  const eye360 = plan.find((r) => r.at === atTime('2026-10-17', '13:30'));
  assert.equal(eye360.text, '1 tablet after lunch.');
});

test('reminders stop before the next slot rings (drops every 15 minutes)', () => {
  const now = atTime('2026-10-17', '06:00');
  const plan = ringPlan(ctx(now), '2026-10-17', '2026-10-17');
  const firstSlot = plan.filter((r) => r.ids.includes('2026-10-17|d2|07:00'));
  assert.deepEqual(firstSlot.map((r) => (r.at - atTime('2026-10-17', '07:00')) / MIN), [0, 10]);
  // With nothing ticked, the 7:15 alarm names the overdue 7:00 drop first.
  const r715 = plan.find((r) => r.at === atTime('2026-10-17', '07:15'));
  assert.ok(r715);
  const ring = activeRing(ctx(atTime('2026-10-17', '07:16')));
  assert.match(ring.text, /② Moxicip, wait 5 min, then ③ Aquim PF/);
  // No two alarms at the same minute.
  const times = plan.map((r) => r.at);
  assert.equal(new Set(times).size, times.length);
});

test('ticking the 7:00 drop late moves the 7:15 drop by the 5-minute gap', () => {
  const date = '2026-10-17';
  const records = { [`${date}|d2|07:00`]: { s: 'done', at: atTime(date, '07:14'), by: '' } };
  const doses = evaluateDay(date, ctx(atTime(date, '07:16'), { records }));
  const aquim = doses.find((d) => d.id === `${date}|d3|07:15`);
  assert.equal(aquim.status, 'gap');
  assert.equal(aquim.waitUntil, atTime(date, '07:19'));
});

test('end dates can be changed for the brother too', () => {
  const m = effectiveMeds({ endOverrides: { d4: '2026-10-20' }, vitaminTime: '14:00' });
  assert.equal(dosesForDate('2026-10-20', m).filter((d) => d.med.id === 'd4').length, 3);
  assert.deepEqual(dosesForDate('2026-10-20', m).filter((d) => d.med.id === 't1').map((d) => d.time), ['14:00']);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
