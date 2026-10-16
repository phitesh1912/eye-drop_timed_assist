// Settings: names, alarm setup checks, schedule changes, backup.

import { MEDS, REGIMEN, fmtDate, fmtClock, originalEnd, medStart } from './schedule.js';
import { esc, icon, badge, medVars } from './ui.js';
import { isAndroidApp, isIOS, isAndroidBrowser, isStandalone, wakeLockSupported, notificationsSupported } from './alarm.js';

const RELEASES = 'https://github.com/phitesh1912/eye-drop_timed_assist/releases/latest/download/';

export function renderSettings(state, c, env) {
  const s = state.settings;
  return `
    <section class="section first">
      <h2 class="section-title">${icon('heart')}Who the drops are for</h2>
      <div class="card form-card">
        <label class="field"><span>Name shown in the app</span>
          <input type="text" maxlength="30" value="${esc(s.patientName)}" placeholder="Name" data-change="patientName" autocomplete="off">
        </label>
        ${REGIMEN.nameIdeas.length ? `<div class="chip-row">${REGIMEN.nameIdeas.map((n) => `<button class="chip ${n === s.patientName ? 'is-on' : ''}" data-act="set-patient" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
        <p class="muted small">Saved only on this phone, never in the public code.</p>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">${icon('heart')}Who puts the drops</h2>
      <div class="card form-card">
        ${s.people.length ? `<div class="people">${s.people.map((p) => `<span class="person">${esc(p)}<button data-act="remove-person" data-name="${esc(p)}" aria-label="Remove ${esc(p)}">${icon('x')}</button></span>`).join('')}</div>`
    : '<p class="muted">Add everyone who will put the drops. Their names appear when ticking a drop.</p>'}
        <form class="add-row" data-submit="add-person">
          <input type="text" name="name" maxlength="30" placeholder="Add a name, e.g. Mom" autocomplete="off" enterkeyhint="done">
          <button class="btn btn-soft" type="submit">${icon('plus')} Add</button>
        </form>
      </div>
    </section>

    ${isAndroidApp ? androidAlarms(env) : webAlarms(state, env)}

    <section class="section">
      <h2 class="section-title">${icon('calendar')}If the doctor changes the plan</h2>
      <div class="card form-card">
        <p class="muted small">Change when a medicine ends (for example after the follow-up visit). Leave the rest as it is.</p>
        ${MEDS.map((m) => endRow(m, c, s)).join('')}
        ${adjustableRow(s)}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">${icon('download')}Backup</h2>
      <div class="card action-list">
        <button class="action" data-act="export-json">${icon('download')}<div><b>Save a backup</b><span>Do this now and then, and before changing phones</span></div></button>
        <button class="action" data-act="import-json">${icon('upload')}<div><b>Restore a backup</b><span>Replaces the records on this phone</span></div></button>
      </div>
    </section>

    <section class="section">
      <div class="about">
        <div class="about-mark">${icon('drop')}</div>
        <b>${esc(REGIMEN.title)}</b>
        <span>${esc(env.version)} · ${isAndroidApp ? 'Android app' : isStandalone ? 'Home Screen app' : 'web'}</span>
        <span>Follows the hospital’s sheet. Not a substitute for the doctor’s advice.</span>
      </div>
    </section>`;
}

function adjustableRow(s) {
  const med = MEDS.find((m) => m.id === REGIMEN.adjustableTime);
  if (!med) return '';
  return `<label class="field inline"><span>${badge(med, 'xs')} ${esc(med.name)} time</span>
    <input type="time" value="${esc(s.vitaminTime)}" data-change="vitaminTime">
  </label>`;
}

function endRow(m, c, s) {
  const med = c.meds.find((x) => x.id === m.id);
  const orig = originalEnd(m.id);
  const cur = s.endOverrides[m.id] || orig;
  const changed = cur !== orig;
  const start = medStart(m);
  return `<div class="end-row" style="${medVars(m)}">
    <div class="end-name">${badge(m, 'xs')}<span>${esc(m.name)}</span></div>
    <label class="end-input"><span class="sr-only">Last day of ${esc(m.name)}</span>
      <input type="date" value="${cur}" min="${start}" data-change="endDate" data-med="${m.id}">
    </label>
    ${changed ? `<button class="link-btn" data-act="reset-end" data-med="${m.id}">Reset to ${esc(fmtDate(orig, { weekday: false }))}</button>` : `<span class="end-hint">${med && med.phases.length ? 'as on the sheet' : ''}</span>`}
  </div>`;
}

function check(ok, title, text, fix, fixLabel = 'Fix') {
  return `<div class="check ${ok ? 'is-ok' : 'is-bad'}">
    <span class="check-mark">${icon(ok ? 'check' : 'warn')}</span>
    <div><b>${esc(title)}</b><span>${esc(text)}</span></div>
    ${ok || !fix ? '' : `<button class="btn btn-small" data-act="native-fix" data-which="${fix}">${esc(fixLabel)}</button>`}
  </div>`;
}

const BRAND_TIPS = {
  xiaomi: 'Redmi / Xiaomi / POCO: in App info turn on Autostart, and set Battery saver to “No restrictions”.',
  redmi: 'Redmi / Xiaomi / POCO: in App info turn on Autostart, and set Battery saver to “No restrictions”.',
  poco: 'Redmi / Xiaomi / POCO: in App info turn on Autostart, and set Battery saver to “No restrictions”.',
  oppo: 'Oppo: in App info allow Auto launch and Background activity.',
  realme: 'Realme: in App info allow Auto launch and Background activity.',
  oneplus: 'OnePlus: in App info → Battery choose “Allow background activity”.',
  vivo: 'Vivo / iQOO: in Settings → Battery allow High background power usage for Drop Time.',
  iqoo: 'Vivo / iQOO: in Settings → Battery allow High background power usage for Drop Time.',
  samsung: 'Samsung: in App info → Battery choose “Unrestricted”, and keep Drop Time out of Sleeping apps.',
  huawei: 'Huawei / Honor: in Battery → App launch, set Drop Time to Manage manually and allow all.',
  honor: 'Huawei / Honor: in Battery → App launch, set Drop Time to Manage manually and allow all.',
};

function androidAlarms(env) {
  const n = env.native || {};
  const brand = String(n.brand || '').toLowerCase();
  const tip = BRAND_TIPS[brand] || Object.entries(BRAND_TIPS).find(([k]) => brand.includes(k))?.[1];
  const volOk = (n.alarmVolume ?? 1) > 0;
  return `<section class="section">
    <h2 class="section-title">${icon('bell')}Alarm setup</h2>
    <div class="card checks">
      ${check(n.notifications !== false, 'Notifications allowed', 'Needed for the alarm to show and ring.', 'notifications', 'Allow')}
      ${check(n.exact !== false, 'Exact alarm times', 'Rings at the exact minute.', 'exact', 'Allow')}
      ${check(n.fullScreen !== false, 'Full-screen alarm', 'Shows the alarm over the lock screen.', 'fullscreen', 'Allow')}
      ${check(n.battery !== false, 'Battery saver won’t block it', 'Lets the alarm ring even after hours of no use.', 'battery', 'Fix')}
      ${check(volOk, 'Alarm volume is on', volOk ? 'Uses the phone’s alarm volume, rings even on silent.' : 'The phone’s alarm volume is at zero.', 'volume', 'Open')}
      ${tip ? `<div class="check is-tip"><span class="check-mark">${icon('info')}</span><div><b>Tip for this phone</b><span>${esc(tip.replace(/Drop Time/g, REGIMEN.title))}</span></div><button class="btn btn-small" data-act="native-fix" data-which="app">App info</button></div>` : ''}
      <div class="next-alarm">${icon('clock')} Next alarm: <b>${n.nextAlarmAt ? `${esc(fmtDate(localDate(n.nextAlarmAt)))}, ${fmtClock(n.nextAlarmAt)}` : 'none set'}</b></div>
      <div class="btn-row">
        <button class="btn btn-soft" data-act="test-alarm">${icon('bell')} Test alarm in 1 min</button>
        <button class="btn btn-soft" data-act="test-sound">${icon('volume')} Play sound</button>
      </div>
      <p class="muted small">For the test: press the button, lock the phone, and wait one minute.</p>
    </div>
  </section>`;
}

function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function webAlarms(state, env) {
  const s = state.settings;
  const rows = [];
  rows.push(`<div class="check ${env.soundReady ? 'is-ok' : 'is-bad'}">
    <span class="check-mark">${icon(env.soundReady ? 'check' : 'volume')}</span>
    <div><b>Alarm sound</b><span>${env.soundReady ? 'Ready. Keep the phone volume up.' : 'Tap “Play sound” once to switch the sound on.'}</span></div>
    <button class="btn btn-small" data-act="test-sound">Play sound</button>
  </div>`);
  rows.push(`<div class="check">
    <span class="check-mark">${icon('bell')}</span>
    <div><b>Test the alarm</b><span>${env.testAt ? `Rings at ${fmtClock(env.testAt)}. Keep the app open on screen.` : 'Rings in 1 minute, like a real alarm. Keep the app open on screen.'}</span></div>
    <button class="btn btn-small" data-act="web-test-alarm" ${env.testAt ? 'disabled' : ''}>Test</button>
  </div>`);
  if (wakeLockSupported()) {
    rows.push(`<label class="check toggle-row">
      <span class="check-mark">${icon('sun')}</span>
      <div><b>Keep the screen on</b><span>For a phone or tablet kept nearby on charge. The alarm only rings while the app is open.</span></div>
      <input type="checkbox" class="switch" data-change="keepAwake" ${s.keepAwake ? 'checked' : ''}>
    </label>`);
  }
  if (notificationsSupported() && !isIOS) {
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
    rows.push(`<div class="check ${perm === 'granted' ? 'is-ok' : 'is-bad'}">
      <span class="check-mark">${icon('bell')}</span>
      <div><b>Notifications</b><span>${perm === 'granted' ? 'Allowed while the app is open in the background.' : 'Show an alert when the app is in the background.'}</span></div>
      ${perm === 'granted' ? '' : '<button class="btn btn-small" data-act="web-notify">Allow</button>'}
    </div>`);
  }
  if (isIOS && !isStandalone) {
    rows.push(`<button class="check is-bad as-btn" data-act="install-help">
      <span class="check-mark">${icon('download')}</span>
      <div><b>Add to Home Screen</b><span>Needed on iPhone so records stay saved. Tap for the steps.</span></div>
    </button>`);
  }
  const androidCard = isAndroidBrowser ? `<a class="card call-card brand" href="${RELEASES}${REGIMEN.apk}">
      ${icon('android')}<div><b>Get the Android app</b><span>Real alarms that ring even when the app is closed</span></div>${icon('download', 'chev')}
    </a>` : '';
  return `<section class="section">
    <h2 class="section-title">${icon('bell')}Alarms</h2>
    <div class="card checks">${rows.join('')}
      <p class="muted small">On iPhone a web app can only ring while it is open on screen, and iPhones don’t let web apps vibrate. The Calendar alerts ring and vibrate at every drop time even when the app is closed (on silent they only vibrate).</p>
      ${isIOS ? `<a class="btn btn-soft wide" href="calendar/drop-time.ics" target="_blank" rel="noopener" data-mark="calendarAdded">${icon('calendar')} Add all drop times to the iPhone Calendar</a>` : ''}
    </div>
    ${androidCard}
  </section>`;
}
