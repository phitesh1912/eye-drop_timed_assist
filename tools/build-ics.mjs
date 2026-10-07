// Writes docs/calendar/drop-time.ics from the schedule (run: npm run build:ics).
import { mkdirSync, writeFileSync } from 'node:fs';
import { effectiveMeds } from '../docs/js/schedule.js';
import { buildIcs, countAlerts } from '../docs/js/ics.js';

const ics = buildIcs(effectiveMeds({}));
const dir = new URL('../docs/calendar/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('drop-time.ics', dir), ics);
console.log(`docs/calendar/drop-time.ics: ${ics.split('BEGIN:VEVENT').length - 1} events, ${countAlerts(ics)} alerts`);
