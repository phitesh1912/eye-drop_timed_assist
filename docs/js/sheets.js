// Pop-up sheets (who put it, confirm, details, install help, first-run setup)
// and the full-screen alarm.

import { REGIMEN, fmtTime, fmtClock, fmtDate, hhmmOf, label, mealFor, parseDoseId, MEDS, eyeTag, dropTag } from './schedule.js';
import { esc, icon, badge, medVars, medChip } from './ui.js';
import { isAndroidApp, isIOS, isStandalone } from './alarm.js';

function sheetWrap(inner, cls = '') {
  return `<div class="sheet-backdrop" data-act="sheet-close"></div>
    <div class="sheet ${cls}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-grip" aria-hidden="true"></div>${inner}
    </div>`;
}

export function renderSheet(sheet, state, c) {
  if (!sheet) return '';
  switch (sheet.type) {
    case 'who': return whoSheet(sheet, state);
    case 'confirm': return confirmSheet(sheet);
    case 'dose': return doseSheet(sheet, state, c);
    case 'install': return installSheet();
    case 'onboard': return onboardSheet(sheet, state);
    default: return '';
  }
}

function whoSheet(sheet, state) {
  const s = state.settings;
  const people = s.people;
  const title = sheet.title || 'Who put the drop?';
  return sheetWrap(`
    <h3 id="sheet-title">${esc(title)}</h3>
    ${sheet.subtitle ? `<p class="sheet-sub">${sheet.subtitle}</p>` : ''}
    ${people.length ? `<div class="who-grid">${people.map((p) => `
      <button class="who ${p === s.lastPerson ? 'is-last' : ''}" data-act="who" data-name="${esc(p)}">
        <span class="who-avatar">${esc(p.slice(0, 1).toUpperCase())}</span><span>${esc(p)}</span>
      </button>`).join('')}</div>` : '<p class="muted">Type your name once. Next time it’s just one tap.</p>'}
    <form class="add-row" data-submit="who-new">
      <input type="text" name="name" maxlength="30" placeholder="${people.length ? 'Someone else' : 'Your name'}" autocomplete="off" enterkeyhint="done" ${people.length ? '' : 'autofocus'}>
      <button class="btn btn-done" type="submit">${people.length ? 'Add' : 'Save'}</button>
    </form>
    <div class="when-row">
      <label class="when-label">${icon('clock')} Put at
        <input type="time" value="${esc(sheet.when || hhmmOf(Date.now()))}" data-change="whenTime"></label>
      ${sheet.when ? '<button class="link-btn" data-act="when-now">Use now</button>' : '<span class="muted small">now</span>'}
    </div>
    <button class="btn btn-quiet wide" data-act="sheet-close">Cancel</button>`);
}

function confirmSheet(sheet) {
  return sheetWrap(`
    <h3 id="sheet-title">${esc(sheet.title)}</h3>
    ${sheet.text ? `<p class="sheet-sub">${sheet.text}</p>` : ''}
    <div class="stack-sm">
      <button class="btn ${sheet.danger ? 'btn-danger' : 'btn-done'} wide" data-act="confirm-ok">${esc(sheet.ok || 'OK')}</button>
      <button class="btn btn-quiet wide" data-act="sheet-close">${esc(sheet.cancel || 'Cancel')}</button>
    </div>`);
}

function doseSheet(sheet, state, c) {
  const { medId, time, date } = parseDoseId(sheet.id);
  const med = c.meds.find((m) => m.id === medId) || MEDS.find((m) => m.id === medId);
  const r = state.records[sheet.id];
  let body;
  if (r && r.s === 'done') {
    body = `<p class="sheet-sub">Ticked as put at <b>${fmtClock(r.at)}</b>${r.by ? ` by <b>${esc(r.by)}</b>` : ''}.</p>
      <div class="stack-sm">
        <button class="btn btn-soft wide" data-act="dose-retime">${icon('clock')} Change who / time</button>
        <button class="btn btn-danger wide" data-act="dose-undo">${icon('undo')} Undo this tick</button>
        <button class="btn btn-quiet wide" data-act="sheet-close">Close</button>
      </div>`;
  } else if (r && r.s === 'skipped') {
    body = `<p class="sheet-sub">Marked as skipped${r.by ? ` by <b>${esc(r.by)}</b>` : ''}.</p>
      <div class="stack-sm">
        <button class="btn btn-soft wide" data-act="dose-undo">${icon('undo')} Undo skip</button>
        <button class="btn btn-quiet wide" data-act="sheet-close">Close</button>
      </div>`;
  } else {
    body = `<p class="sheet-sub">Not ticked. If it was actually put and someone forgot to tick it, record it now.</p>
      <div class="stack-sm">
        <button class="btn btn-done wide" data-act="dose-fix">${icon('check')} It was put. Tick it</button>
        <button class="btn btn-quiet wide" data-act="sheet-close">Close</button>
      </div>`;
  }
  return sheetWrap(`
    <div class="sheet-med" style="${medVars(med)}">${badge(med, 'md')}<div><b>${esc(med.name)}</b><span>${esc(fmtDate(date))} · due ${fmtTime(time)}</span></div></div>
    ${body}`);
}

function installSheet() {
  return sheetWrap(`
    <h3 id="sheet-title">Add ${esc(REGIMEN.title)} to the Home Screen</h3>
    <p class="sheet-sub">Then always open it from the new icon. On iPhone this keeps the records safe.</p>
    <ol class="steps">
      <li><span class="step-n">1</span><div>Open this page in <b>Safari</b>. Tap the <b>Share</b> button ${icon('share')} at the bottom (or top) of the screen.</div></li>
      <li><span class="step-n">2</span><div>Scroll down and tap <b>Add to Home Screen</b>.</div></li>
      <li><span class="step-n">3</span><div>Tap <b>Add</b>. Open <b>${esc(REGIMEN.title)}</b> from the Home Screen from now on.</div></li>
    </ol>
    <p class="muted small">Start using it from the Home Screen icon. Ticks made in the Safari tab stay in the Safari tab.</p>
    <button class="btn btn-done wide" data-act="sheet-close">Got it</button>`);
}

export function calendarButton(cls) {
  return `<a class="${cls}" href="calendar/drop-time.ics" target="_blank" rel="noopener" data-mark="calendarAdded">${icon('calendar')} Add all drop times to the iPhone Calendar</a>`;
}

function onboardSheet(sheet, state) {
  const ideas = REGIMEN.nameIdeas || [];
  const s = state.settings;
  if (sheet.step === 2) {
    let alarmPart;
    if (isAndroidApp) {
      alarmPart = `<p>The phone will ring like an alarm clock at every drop time, even when the app is closed or the phone is locked.</p>
        <button class="btn btn-done wide" data-act="onboard-allow">${icon('bell')} Allow alarms</button>
        <p class="muted small">If Android asks, choose <b>Allow</b>. You can check everything later in Settings.</p>`;
    } else if (isIOS) {
      alarmPart = `${isStandalone ? '' : `<p><b>1. Add it to the Home Screen.</b> Tap Share ${icon('share')} then <b>Add to Home Screen</b>, and open ${esc(REGIMEN.title)} from the new icon.</p>`}
        <p><b>${isStandalone ? '' : '2. '}Add every drop time to the iPhone Calendar.</b> The app can only ring while it’s open on screen. The Calendar alerts at every drop time even when it’s closed (keep the silent switch off).</p>
        ${calendarButton('btn btn-soft wide')}
        <button class="btn btn-quiet wide" data-act="test-sound">${icon('volume')} Test the alarm sound</button>`;
    } else {
      alarmPart = `<p>The alarm rings <b>while this app is open</b>. Keep it open on a phone or tablet near ${esc(s.patientName || 'you')}.</p>
        <button class="btn btn-soft wide" data-act="test-sound">${icon('volume')} Test the alarm sound</button>`;
    }
    return sheetWrap(`
      <div class="onboard-art">${icon('bell')}</div>
      <h3 id="sheet-title">Alarms</h3>
      ${alarmPart}
      <button class="btn btn-done wide" data-act="onboard-finish">Start</button>`, 'sheet-full');
  }
  return sheetWrap(`
    <div class="onboard-art">${icon('drop')}</div>
    <h3 id="sheet-title">Welcome to ${esc(REGIMEN.title)}</h3>
    <p class="sheet-sub">${REGIMEN.ui === 'modern' ? 'Every eye drop after laser eye surgery, on time, with a record of each one.' : 'Eye drops after cataract surgery, on time, with a record of every drop.'}</p>
    <label class="field"><span>Whose eye drops are these?</span>
      <input type="text" maxlength="30" value="${esc(s.patientName)}" placeholder="Name" data-change="patientName" autocomplete="off">
    </label>
    ${ideas.length ? `<div class="chip-row">${ideas.map((n) => `<button class="chip ${n === s.patientName ? 'is-on' : ''}" data-act="set-patient" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="field"><span>Who will put the drops?</span></div>
    ${s.people.length ? `<div class="people">${s.people.map((p) => `<span class="person">${esc(p)}<button data-act="remove-person" data-name="${esc(p)}" aria-label="Remove ${esc(p)}">${icon('x')}</button></span>`).join('')}</div>` : ''}
    <form class="add-row" data-submit="add-person">
      <input type="text" name="name" maxlength="30" placeholder="${REGIMEN.ui === 'modern' ? 'Add a name (yours too)' : 'Add a name, e.g. Mom'}" autocomplete="off" enterkeyhint="done">
      <button class="btn btn-soft" type="submit">${icon('plus')} Add</button>
    </form>
    <p class="muted small">${REGIMEN.ui === 'modern' ? 'With just one name, Done ticks straight away.' : 'You can add more names any time.'}</p>
    <button class="btn btn-done wide" data-act="onboard-next">Next</button>`, 'sheet-full');
}

// ---------------------------------------------------------------- alarm screen

export function renderAlarm(ring, doses, c, env) {
  if (!ring) return '';
  // A drop alarm shows every drop waiting right now, in the order to put them.
  const isDropRing = ring.ids.some((id) => parseDoseId(id).medId.startsWith('d'));
  const list = isDropRing
    ? doses.filter((d) => d.med.kind === 'drop' && ['due', 'gap', 'queued'].includes(d.status))
    : doses.filter((d) => ring.ids.includes(d.id));
  if (!list.length) return '';
  const head = list[0];
  const rest = list.slice(1);
  const isTablet = head.med.kind === 'tablet';
  return `<div class="alarm" role="alertdialog" aria-labelledby="alarm-title" style="${medVars(head.med)}">
    <div class="alarm-inner">
      <div class="alarm-kicker">${icon('bell')} ${ring.nag ? 'Reminder · not ticked yet' : isTablet ? 'Tablet time' : 'Eye drop time'}</div>
      <div class="alarm-clock">${fmtTime(head.time)}</div>
      <div class="alarm-pulse">${badge(head.med, 'xl')}</div>
      <h2 id="alarm-title" class="alarm-name">${esc(head.med.name)}</h2>
      <div class="alarm-box">${esc(head.med.box)}</div>
      <div class="alarm-tags">
        ${isTablet ? `<span>${icon('pill')} 1 tablet ${esc(mealFor(head.time, head.med))}</span>`
    : `<span class="is-eye">${icon('eye')} ${esc(eyeTag())}</span><span>${icon('drop')} ${esc(dropTag())}</span>${head.med.shake ? `<span>${icon('shake')} Shake well</span>` : ''}`}
      </div>
      ${rest.length ? `<div class="alarm-then">Then, ${c.gapMin} min later: ${rest.map((d) => esc(label(d.med))).join(', ')}</div>` : ''}
      ${head.status === 'gap' ? `<div class="alarm-then">Wait until ${fmtClock(head.waitUntil)} before putting this drop</div>` : ''}
      <div class="alarm-actions">
        <button class="btn btn-alarm-stop" data-act="alarm-stop">${icon('check')} Stop alarm</button>
        <button class="btn btn-alarm-snooze" data-act="alarm-snooze">${icon('clock')} Remind me in 5 min</button>
      </div>
      ${env.soundBlocked ? '<div class="alarm-note">Sound is off: the screen hasn’t been touched since the app opened. Keep the app open and touch it once.</div>' : ''}
      <div class="alarm-hint">After putting it, tick <b>Done</b> on the card.</div>
    </div>
  </div>`;
}

export { medChip };
