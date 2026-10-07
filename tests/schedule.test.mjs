// Run with: npm test   (sets TZ=Asia/Kolkata so local times match the family's)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDS, MIN, atTime, addDays, dayNumber, fmtTime, fmtDate, effectiveMeds, dosesForDate,
  evaluateDay, summarizeDay, ringPlan, activeRing, scheduleChanges, slotTimes, courseBounds,
} from '../docs/js/schedule.js';

const meds = effectiveMeds({});
const ids = (doses) => doses.map((d) => `${d.time} ${d.med.id}`);
const ctx = (now, extra = {}) => ({ now, meds, records: {}, snoozes: {}, gapMin: 5, onTimeMin: 30, nagMins: [10, 20], ...extra });
const done = (date, medId, time, atHHMM, by = 'Mom') => [`${date}|${medId}|${time}`, { s: 'done', at: atTime(date, atHHMM), by }];

test('runs in India time', () => {
  assert.equal(new Date(atTime('2026-10-08', '07:00')).toISOString(), '2026-10-08T01:30:00.000Z');
});

test('day numbers: surgery day is Day 1, tomorrow is Day 2', () => {
  assert.equal(dayNumber('2026-10-07'), 1);
  assert.equal(dayNumber('2026-10-08'), 2);
  assert.equal(dayNumber('2026-10-14'), 8);
  assert.equal(fmtDate('2026-10-08'), 'Thu, 8 Oct');
  assert.equal(fmtTime('14:30'), '2:30 PM');
  assert.equal(fmtTime('12:00'), '12:00 PM');
  assert.equal(fmtTime('00:00'), '12:00 AM');
});

test('nothing is scheduled on surgery day (handled before the app)', () => {
  assert.equal(dosesForDate('2026-10-07', meds).length, 0);
});

test('tomorrow (8 Oct): 16 drops at 14 times + vitamin', () => {
  const doses = dosesForDate('2026-10-08', meds);
  const drops = doses.filter((d) => d.med.kind === 'drop');
  assert.equal(drops.length, 16);
  assert.equal(doses.filter((d) => d.med.kind === 'tablet').length, 1);
  assert.equal(new Set(drops.map((d) => d.time)).size, 14);
  assert.deepEqual(ids(drops), [
    '07:00 d2', '07:30 d4', '08:00 d3', '08:00 d5', '10:00 d2', '12:00 d5', '13:00 d2',
    '14:00 d3', '14:30 d4', '16:00 d2', '16:00 d5', '19:00 d2', '20:00 d5', '21:00 d3', '21:30 d4', '22:00 d2',
  ]);
});

test('Moxicip D (2) runs till 13 Oct; Pred Forte (1) starts 14 Oct', () => {
  const on13 = dosesForDate('2026-10-13', meds);
  const on14 = dosesForDate('2026-10-14', meds);
  assert.equal(on13.filter((d) => d.med.id === 'd2').length, 6);
  assert.equal(on13.filter((d) => d.med.id === 'd1').length, 0);
  assert.equal(on14.filter((d) => d.med.id === 'd2').length, 0);
  assert.deepEqual(on14.filter((d) => d.med.id === 'd1').map((d) => d.time), ['07:00', '11:00', '14:30', '17:00', '21:00']);
});

test('Pred Forte steps down every week', () => {
  const pred = (date) => dosesForDate(date, meds).filter((d) => d.med.id === 'd1').map((d) => d.time);
  assert.deepEqual(pred('2026-10-20'), ['07:00', '11:00', '14:30', '17:00', '21:00']);
  assert.deepEqual(pred('2026-10-21'), ['07:00', '12:00', '17:00', '21:00']);
  assert.deepEqual(pred('2026-10-28'), ['07:00', '16:00', '21:00']);
  assert.deepEqual(pred('2026-11-04'), ['07:00', '19:00']);
  assert.deepEqual(pred('2026-11-11'), ['07:00']);
  assert.deepEqual(pred('2026-11-17'), ['07:00']);
  assert.deepEqual(pred('2026-11-18'), []);
});

test('drops per day over the course', () => {
  const drops = (date) => dosesForDate(date, meds).filter((d) => d.med.kind === 'drop').length;
  assert.equal(drops('2026-10-13'), 16);
  assert.equal(drops('2026-10-14'), 15);
  assert.equal(drops('2026-10-20'), 15);
  assert.equal(drops('2026-10-21'), 11); // Dortas finished
  assert.equal(drops('2026-10-28'), 10);
  assert.equal(drops('2026-11-04'), 9);
  assert.equal(drops('2026-11-06'), 9);
  assert.equal(drops('2026-11-07'), 5); // Trehalube finished
  assert.equal(drops('2026-11-11'), 4);
  assert.equal(drops('2026-11-18'), 3); // only Micronac
  assert.equal(drops('2026-11-20'), 3);
  assert.equal(drops('2026-11-21'), 0);
  assert.deepEqual(courseBounds(meds), { first: '2026-10-08', last: '2026-11-20' });
});

test('end date and vitamin time can be changed', () => {
  const m = effectiveMeds({ endOverrides: { d4: '2026-10-21', d5: '2026-10-30' }, vitaminTime: '13:30' });
  assert.equal(dosesForDate('2026-10-21', m).filter((d) => d.med.id === 'd4').length, 3);
  assert.equal(dosesForDate('2026-10-31', m).filter((d) => d.med.id === 'd5').length, 0);
  assert.deepEqual(dosesForDate('2026-10-10', m).filter((d) => d.med.id === 't1').map((d) => d.time), ['13:30']);
  // Shortening Pred Forte to mid-week 2 drops later phases.
  const p = effectiveMeds({ endOverrides: { d1: '2026-10-17' } });
  assert.equal(dosesForDate('2026-10-17', p).filter((d) => d.med.id === 'd1').length, 5);
  assert.equal(dosesForDate('2026-10-18', p).filter((d) => d.med.id === 'd1').length, 0);
});

test('8:00 double drop: Micronac first, then Trehalube after a 5 minute gap', () => {
  const date = '2026-10-08';
  const at800 = atTime(date, '08:00');
  let doses = evaluateDay(date, ctx(at800, { records: Object.fromEntries([done(date, 'd2', '07:00', '07:02'), done(date, 'd4', '07:30', '07:31')]) }));
  const st = (id) => doses.find((d) => d.id === `${date}|${id}`).status;
  assert.equal(st('d3|08:00'), 'due');
  assert.equal(st('d5|08:00'), 'queued');

  const records = Object.fromEntries([done(date, 'd2', '07:00', '07:02'), done(date, 'd4', '07:30', '07:31'), done(date, 'd3', '08:00', '08:02')]);
  doses = evaluateDay(date, ctx(atTime(date, '08:04'), { records }));
  const treha = doses.find((d) => d.id === `${date}|d5|08:00`);
  assert.equal(treha.status, 'gap');
  assert.equal(treha.waitUntil, atTime(date, '08:07'));

  doses = evaluateDay(date, ctx(atTime(date, '08:07'), { records }));
  assert.equal(doses.find((d) => d.id === `${date}|d5|08:00`).status, 'due');

  // The alarm for Trehalube moves to 8:07.
  const plan = ringPlan(ctx(atTime(date, '08:04'), { records }), date, date);
  const next = plan.find((r) => r.at > atTime(date, '08:04'));
  assert.equal(next.at, atTime(date, '08:07'));
  assert.match(next.text, /Trehalube/);
  assert.doesNotMatch(next.text, /Micronac/);
});

test('a dose becomes missed when the next dose of the same drop is due', () => {
  const date = '2026-10-08';
  let doses = evaluateDay(date, ctx(atTime(date, '09:59')));
  assert.equal(doses.find((d) => d.id === `${date}|d2|07:00`).status, 'due');
  doses = evaluateDay(date, ctx(atTime(date, '10:00')));
  assert.equal(doses.find((d) => d.id === `${date}|d2|07:00`).status, 'missed');
  // Nothing ticked all morning: the overdue 7:30 drop goes first, 10:00 waits its turn.
  assert.equal(doses.find((d) => d.id === `${date}|d4|07:30`).status, 'due');
  assert.equal(doses.find((d) => d.id === `${date}|d2|10:00`).status, 'queued');
  const morningDone = Object.fromEntries([
    done(date, 'd4', '07:30', '07:31'), done(date, 'd3', '08:00', '08:00'), done(date, 'd5', '08:00', '08:06'),
  ]);
  doses = evaluateDay(date, ctx(atTime(date, '10:00'), { records: morningDone }));
  assert.equal(doses.find((d) => d.id === `${date}|d2|10:00`).status, 'due');
  // Last dose of the day: missed at midnight.
  doses = evaluateDay(date, ctx(atTime(date, '23:59')));
  assert.equal(doses.find((d) => d.id === `${date}|d2|22:00`).status, 'queued'); // still open
  assert.equal(doses.find((d) => d.id === `${date}|d5|20:00`).status, 'due'); // oldest open drop leads
  doses = evaluateDay(date, ctx(atTime('2026-10-09', '00:00')));
  assert.equal(doses.find((d) => d.id === `${date}|d2|22:00`).status, 'missed');
});

test('timing: on time within 30 min, otherwise late', () => {
  const date = '2026-10-08';
  const records = Object.fromEntries([done(date, 'd2', '07:00', '07:25'), done(date, 'd4', '07:30', '08:15')]);
  const doses = evaluateDay(date, ctx(atTime(date, '08:20'), { records }));
  assert.equal(doses.find((d) => d.id === `${date}|d2|07:00`).timing, 'ontime');
  const dortas = doses.find((d) => d.id === `${date}|d4|07:30`);
  assert.equal(dortas.timing, 'late');
  assert.equal(dortas.delayMin, 45);
});

test('day summary: a perfect day, a day with a miss, and today in progress', () => {
  const date = '2026-10-08';
  const all = Object.fromEntries(dosesForDate(date, meds).map((d) => [d.id, { s: 'done', at: d.at + 3 * MIN, by: 'Dad' }]));
  let s = summarizeDay(date, ctx(atTime('2026-10-09', '07:00'), { records: all }));
  assert.equal(s.status, 'perfect');
  assert.equal(s.done, 17);
  assert.equal(s.ontime, 17);
  assert.equal(s.drops, 16);

  const oneMissing = { ...all };
  delete oneMissing[`${date}|d3|14:00`];
  s = summarizeDay(date, ctx(atTime('2026-10-09', '07:00'), { records: oneMissing }));
  assert.equal(s.status, 'missed');
  assert.equal(s.missed, 1);

  s = summarizeDay(date, ctx(atTime(date, '12:30')));
  assert.equal(s.status, 'missed'); // nothing ticked all morning
  s = summarizeDay('2026-10-09', ctx(atTime(date, '12:30')));
  assert.equal(s.status, 'future');
});

test('alarms for tomorrow: first one 7:00 AM Moxicip D, with two reminders', () => {
  const now = atTime('2026-10-07', '21:00');
  const plan = ringPlan(ctx(now), '2026-10-08', '2026-10-08');
  const first = plan[0];
  assert.equal(first.at, atTime('2026-10-08', '07:00'));
  assert.match(first.text, /② Moxicip D/);
  assert.match(first.text, /RIGHT eye/);
  assert.deepEqual(plan.slice(0, 3).map((r) => r.nag), [0, 1, 2]);
  assert.equal(plan[1].at, atTime('2026-10-08', '07:10'));
  // 8:00 slot is one alarm naming both drops in order.
  const eight = plan.find((r) => r.at === atTime('2026-10-08', '08:00'));
  assert.match(eight.text, /③ Micronac PF, wait 5 min, then ⑤ Trehalube/);
  // 14 drop slots + vitamin, each with 3 rings (first + 2 reminders).
  assert.equal(plan.filter((r) => r.nag === 0).length, 15);
});

test('ticking a dose removes its reminders', () => {
  const date = '2026-10-08';
  const records = Object.fromEntries([done(date, 'd2', '07:00', '07:03')]);
  const plan = ringPlan(ctx(atTime(date, '07:04'), { records }), date, date);
  assert.ok(!plan.some((r) => r.ids.includes(`${date}|d2|07:00`)));
});

test('snooze moves the alarm by 5 minutes', () => {
  const date = '2026-10-08';
  const now = atTime(date, '07:01');
  const snoozes = { [`${date}|d2|07:00`]: now + 5 * MIN };
  const plan = ringPlan(ctx(now, { snoozes }), date, date);
  const next = plan.find((r) => r.at > now);
  assert.equal(next.at, now + 5 * MIN);
});

test('active ring: rings at 7:00, silenced by ack, rings again at 7:10', () => {
  const date = '2026-10-08';
  const c = ctx(atTime(date, '07:00'));
  const ring = activeRing(c);
  assert.ok(ring);
  assert.equal(activeRing(c, { [ring.key]: true }), null);
  const again = activeRing(ctx(atTime(date, '07:10')), { [ring.key]: true });
  assert.equal(again.nag, 1);
  assert.equal(activeRing(ctx(atTime(date, '06:59'))), null);
});

test('a drop due while an earlier one is still waiting gets its own alarm', () => {
  const date = '2026-10-08';
  const plan = ringPlan(ctx(atTime(date, '07:25')), date, date);
  const r = plan.find((x) => x.at === atTime(date, '07:30'));
  assert.ok(r);
  assert.match(r.text, /② Moxicip D, wait 5 min, then ④ Dortas/);
});

test('schedule changes list the switch on 14 Oct', () => {
  const changes = scheduleChanges(meds);
  const oct14 = changes.find((c) => c.date === '2026-10-14');
  assert.ok(oct14.items.some((i) => i.med.id === 'd1' && i.type === 'start'));
  assert.ok(oct14.items.some((i) => i.med.id === 'd2' && i.type === 'stop'));
  const oct21 = changes.find((c) => c.date === '2026-10-21');
  assert.ok(oct21.items.some((i) => i.med.id === 'd4' && i.type === 'stop'));
  assert.ok(oct21.items.some((i) => i.med.id === 'd1' && i.type === 'change'));
  assert.equal(changes.at(-1).date, '2026-11-21');
});

test('slot times', () => {
  assert.equal(slotTimes('2026-10-08', meds).length, 15); // 14 drop times + 9:00 vitamin
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(MEDS.length, 6);
});

test('calendar file: one alert per time slot for the whole course', async () => {
  const { buildIcs, countAlerts } = await import('../docs/js/ics.js');
  const ics = buildIcs(meds);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  // Every slot of every day, counted the same way as the app.
  let slots = 0;
  for (let d = '2026-10-08'; d <= '2026-11-20'; d = addDays(d, 1)) slots += slotTimes(d, meds).length;
  assert.equal(countAlerts(ics), slots);
  assert.match(ics, /DTSTART:20261008T070000\r\n/);
  assert.match(ics, /SUMMARY:💧 ② Moxicip D/);
  assert.match(ics, /TRIGGER:PT0S/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});
