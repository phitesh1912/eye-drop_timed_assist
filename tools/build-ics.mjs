// Writes the calendar files for both apps (run: npm run build:ics).
import { mkdirSync, writeFileSync } from 'node:fs';
import { REGIMENS } from '../docs/js/regimens.js';
import { effectiveMeds, setRegimen } from '../docs/js/schedule.js';
import { buildIcs, countAlerts } from '../docs/js/ics.js';

const targets = [
  ['grandma', '../docs/calendar/'],
  ['brother', '../docs/brother/calendar/'],
];
for (const [id, folder] of targets) {
  setRegimen(REGIMENS[id]);
  const ics = buildIcs(effectiveMeds({}));
  const dir = new URL(folder, import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('drop-time.ics', dir), ics);
  console.log(`${folder.slice(3)}drop-time.ics: ${ics.split('BEGIN:VEVENT').length - 1} events, ${countAlerts(ics)} alerts`);
}
