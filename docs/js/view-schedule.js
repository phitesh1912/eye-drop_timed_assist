// Schedule: the whole plan from the hospital sheet, day by day and drop by drop.

import {
  COURSE, ymd, addDays, fmtDate, fmtTime, dayNumber, courseBounds, scheduleChanges, timesPerDayText,
  slotTimes, medStart, medEnd, originalEnd, label, mealFor,
} from './schedule.js';
import { esc, icon, badge, medVars } from './ui.js';
import { timetableRows, changeLine } from './view-today.js';
import { isAndroidApp } from './alarm.js';

export function renderSchedule(state, c, ui) {
  const today = ymd(c.now);
  const { first, last } = courseBounds(c.meds);
  let day = ui.planDate || (today < first ? first : today > last ? last : today);
  if (day < first) day = first;
  if (day > last) day = last;

  const changes = scheduleChanges(c.meds).filter((ch) => ch.date >= (today < first ? first : today) && ch.date !== first);
  return `
    <section class="section first">
      <div class="day-stepper card">
        <button class="icon-btn" data-act="plan-day" data-date="${addDays(day, -1)}" ${day <= first ? 'disabled' : ''} aria-label="Previous day">${icon('chevron', 'flip')}</button>
        <div class="stepper-mid"><b>${esc(fmtDate(day))}</b><span>Day ${dayNumber(day)}${day === today ? ' · today' : ''}</span></div>
        <button class="icon-btn" data-act="plan-day" data-date="${addDays(day, 1)}" ${day >= last ? 'disabled' : ''} aria-label="Next day">${icon('chevron')}</button>
      </div>
      <div class="card list-card">${timetableRows(day, c.meds, c.gapMin)}</div>
    </section>

    ${changes.length ? `<section class="section">
      <h2 class="section-title">${icon('calendar')}Changes ahead</h2>
      <div class="card timeline">${changes.map((ch) => `
        <div class="tl-item">
          <div class="tl-date"><b>${esc(fmtDate(ch.date))}</b><span>Day ${dayNumber(ch.date)}</span></div>
          <ul>${ch.items.map((it) => `<li style="${medVars(it.med)}">${badge(it.med, 'xs')}<span>${changeLine(it)}</span></li>`).join('')}</ul>
        </div>`).join('')}
      </div>
    </section>` : ''}

    <section class="section">
      <h2 class="section-title">${icon('drop')}The medicines</h2>
      <div class="stack">${c.meds.map((m) => medCard(m, today)).join('')}</div>
    </section>

    <section class="section">
      <h2 class="section-title">${icon('info')}How to put eye drops</h2>
      <div class="card tips">
        <ol>
          <li><b>Wash hands</b> with soap first.</li>
          <li>Check the <b>number on the box</b> matches the app. <b>${COURSE.eye} eye only.</b></li>
          <li><b>Shake</b> ① Pred Forte and ③ Micronac PF before use.</li>
          <li>Tilt the head back, gently pull the lower eyelid down, put <b>1 drop</b>.</li>
          <li><b>Don’t touch</b> the eye or eyelashes with the bottle tip.</li>
          <li>Close the eye gently for about a minute. <b>Don’t rub or press</b> it.</li>
          <li>Wait <b>${c.gapMin} minutes</b> before a different drop. The app times this for you.</li>
        </ol>
        <p class="muted">Only use the drops and tablets the doctor selected. If there is severe pain, sudden blurring or anything worrying, call the hospital.</p>
      </div>
    </section>

    ${outsideReminders(c, today, first)}

    <section class="section">
      <a class="card call-card" href="tel:+91${esc(state.settings.hospitalPhone)}">
        ${icon('phone')}<div><b>Call the hospital</b><span>${esc(state.settings.hospitalPhone)}</span></div>${icon('chevron', 'chev')}
      </a>
    </section>`;
}

function medCard(m, today) {
  const start = medStart(m);
  const end = medEnd(m);
  const changed = end !== originalEnd(m.id);
  const active = start && today >= start && today <= end;
  const finished = end && today > end;
  const status = !start ? 'Not used' : finished ? 'Finished' : active ? `Day ${dayNumber(today) - dayNumber(start) + 1} of ${dayNumber(end) - dayNumber(start) + 1}` : `Starts ${fmtDate(start)}`;
  const phases = m.phases.map((p) => `<div class="phase">
      <div class="phase-dates">${esc(fmtDate(p.from, { weekday: false }))} – ${esc(fmtDate(p.to, { weekday: false }))}</div>
      <div class="phase-times"><b>${timesPerDayText(p.times.length)}</b> · ${p.times.map(fmtTime).join(', ')}</div>
    </div>`).join('');
  return `<article class="card med-card ${finished ? 'is-finished' : ''}" style="${medVars(m)}">
    <div class="med-head">${badge(m, 'md')}
      <div><b>${esc(m.name)}</b><span>${esc(m.generic)}</span></div>
      <span class="pill ${active ? 'pill-now' : 'pill-muted'}">${esc(status)}</span>
    </div>
    <div class="med-box"><i class="swatch"></i>${esc(m.box)}${m.shake ? ` · <b>shake well</b>` : ''}${m.kind === 'tablet' ? ` · ${esc(mealFor(m.phases[0]?.times[0] || '09:00'))}` : ''}</div>
    ${phases}
    ${changed ? '<div class="med-note">End date changed in Settings</div>' : ''}
  </article>`;
}

function outsideReminders(c, today, first) {
  const ref = today < first ? first : today;
  const times = slotTimes(ref, c.meds);
  if (isAndroidApp) return '';
  return `<section class="section">
    <h2 class="section-title">${icon('bell')}Reminders when the app is closed</h2>
    <div class="card action-list">
      <a class="action" href="calendar/drop-time.ics" target="_blank" rel="noopener">${icon('calendar')}<div><b>Add all drop times to the phone calendar</b><span>On iPhone tap “Add All”. The calendar then alerts at each time, even when this app is closed (turn the silent switch off).</span></div></a>
      <div class="action is-static">${icon('clock')}<div><b>Or set Clock alarms for ${esc(fmtDate(ref))}</b><span>${times.map(fmtTime).join(' · ')}</span></div></div>
    </div>
  </section>`;
}

export { label };
