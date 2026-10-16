// Calendar file (.ics) with an alert at every drop time: a backup reminder for
// phones where the web app can't ring while closed (iPhone). Times are
// "floating" local times, so 8:00 AM stays 8:00 AM on the phone.

import { COURSE, REGIMEN, addDays, courseBounds, dosesForDate, label, mealFor } from './schedule.js';

const enc = new TextEncoder();

function fold(line) {
  // RFC 5545: lines longer than 75 octets continue on the next line after a space.
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const text = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

function slotsOf(date, meds) {
  const map = new Map();
  for (const d of dosesForDate(date, meds)) {
    const key = d.med.kind === 'drop' ? `drop@${d.time}` : `${d.med.id}@${d.time}`;
    if (!map.has(key)) map.set(key, { time: d.time, doses: [] });
    map.get(key).doses.push(d);
  }
  for (const s of map.values()) s.sig = s.doses.map((d) => d.med.id).join('+');
  return map;
}

function eventLines(run, gapMin, stamp) {
  const { start, count, slot } = run;
  const drops = slot.doses.filter((d) => d.med.kind === 'drop');
  const hhmm = slot.time.replace(':', '');
  let summary;
  let desc;
  if (drops.length) {
    summary = `💧 ${drops.map((d) => label(d.med)).join(' → ')}`;
    const where = COURSE.eye === 'BOTH' ? '1 drop in each eye' : `1 drop in the ${COURSE.eye} eye`;
    desc = `${where}${drops.length > 1 ? ` for each. Wait ${gapMin} min between different drops` : ''}. Tick it in ${REGIMEN.title}.`;
  } else {
    const t = slot.doses[0];
    summary = `💊 ${t.med.name} (${mealFor(slot.time, t.med)})`;
    desc = `${t.med.generic}: 1 tablet ${mealFor(slot.time, t.med)}. Tick it in ${REGIMEN.title}.`;
  }
  const lines = [
    'BEGIN:VEVENT',
    // Grandma's UIDs stay as first published, so re-importing doesn't duplicate events.
    `UID:droptime-${REGIMEN.id === 'grandma' ? '' : `${REGIMEN.id}-`}${start}-${hhmm}-${slot.sig}@drop-time`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start.replace(/-/g, '')}T${hhmm}00`,
    'DURATION:PT10M',
  ];
  if (count > 1) lines.push(`RRULE:FREQ=DAILY;COUNT=${count}`);
  lines.push(
    `SUMMARY:${text(summary)}`,
    `DESCRIPTION:${text(desc)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text(summary)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
  );
  return lines;
}

export function buildIcs(meds, { gapMin = 5, stamp = '20261007T000000Z' } = {}) {
  const { first, last } = courseBounds(meds);
  const runs = [];
  const open = new Map();
  let prevDate = null;
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const slots = slotsOf(date, meds);
    for (const [key, run] of open) {
      const s = slots.get(key);
      if (!s || s.sig !== run.slot.sig) {
        runs.push(run);
        open.delete(key);
      }
    }
    for (const [key, slot] of slots) {
      const run = open.get(key);
      if (run && prevDate && addDays(prevDate, 1) === date) run.count++;
      else open.set(key, { start: date, count: 1, slot });
    }
    prevDate = date;
  }
  runs.push(...open.values());
  runs.sort((a, b) => a.start.localeCompare(b.start) || a.slot.time.localeCompare(b.slot.time));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Drop Time//Eye drop reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Eye drops (${REGIMEN.title})`,
  ];
  for (const run of runs) lines.push(...eventLines(run, gapMin, stamp));
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// Expands the runs back into individual times (used by the tests).
export function countAlerts(ics) {
  let total = 0;
  for (const block of ics.split('BEGIN:VEVENT').slice(1)) {
    const m = block.match(/RRULE:FREQ=DAILY;COUNT=(\d+)/);
    total += m ? Number(m[1]) : 1;
  }
  return total;
}
