// Drop Time: app start-up, the once-a-second clock, alarms and button handling.

import * as S from './schedule.js';
import * as store from './store.js';
import * as alarm from './alarm.js';
import { esc, icon, countdownText, relText } from './ui.js';
import { renderToday } from './view-today.js';
import { renderRecords, csvExport, reportText } from './view-records.js';
import { renderSchedule } from './view-schedule.js';
import { renderSettings } from './view-settings.js';
import { renderSheet, renderAlarm } from './sheets.js';

const VERSION = '1.0.0';
const RING_MIN = 10; // an alarm rings for up to 10 minutes, then the next reminder takes over

let state = store.load();
const ui = { tab: 'today', sheet: null, openDay: null, planDate: null, ring: null, sig: '', soundBlocked: false, pendingRender: false };
let nativeCache = null;
let nativeCacheAt = 0;

const $ = (sel) => document.querySelector(sel);

function ctx(now = Date.now()) {
  const s = state.settings;
  return {
    now,
    meds: S.effectiveMeds(s),
    records: state.records,
    snoozes: state.snoozes,
    gapMin: s.gapMin,
    onTimeMin: s.onTimeMin,
    nagMins: s.nagMins,
  };
}

function nativeInfo(maxAge = 4000) {
  if (!alarm.isAndroidApp) return null;
  if (!nativeCache || Date.now() - nativeCacheAt > maxAge) {
    nativeCache = alarm.nativeInfo();
    nativeCacheAt = Date.now();
  }
  return nativeCache;
}

function alarmProblem(n) {
  if (!n) return '';
  if (n.notifications === false) return 'Notifications are off for Drop Time.';
  if (n.exact === false) return 'Exact alarms are not allowed.';
  if (n.alarmVolume === 0) return 'The phone’s alarm volume is at zero.';
  return '';
}

function env() {
  const n = nativeInfo();
  return {
    native: n,
    version: `v${VERSION}${n && n.appVersion ? ` · app ${n.appVersion}` : ''}`,
    saveFailed: store.lastSaveFailed(),
    showInstall: alarm.isIOS && !alarm.isStandalone,
    soundLocked: !alarm.isAndroidApp && !alarm.soundReady() && state.settings.onboarded,
    soundReady: alarm.soundReady(),
    alarmProblem: alarmProblem(n),
    ringIds: ui.ring ? ui.ring.ids : [],
    soundBlocked: ui.soundBlocked,
  };
}

// ---------------------------------------------------------------- rendering

const TABS = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'records', label: 'Records', icon: 'list' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar' },
  { id: 'settings', label: 'Settings', icon: 'sliders' },
];

function renderTopbar(c) {
  const today = S.ymd(c.now);
  const day = S.dayNumber(today);
  $('#topbar').innerHTML = `<div class="topbar-inner">
    <div class="brand">${icon('drop')}<span>Drop Time</span></div>
    <div class="topbar-right"><b>${esc(S.fmtDate(today))}${day >= 1 ? ` · Day ${day}` : ''}</b>
      <span>${esc(state.settings.patientName)} · ${S.COURSE.eye} eye</span></div>
  </div>`;
}

function renderTabbar(c) {
  const doses = S.evaluateDay(S.ymd(c.now), c);
  const due = doses.some((d) => d.status === 'due');
  $('#tabbar').innerHTML = TABS.map((t) => `<button class="tab ${ui.tab === t.id ? 'is-on' : ''}" data-act="tab" data-tab="${t.id}" aria-current="${ui.tab === t.id ? 'page' : 'false'}">
      ${icon(t.icon)}<span>${t.label}</span>${t.id === 'today' && due && ui.tab !== 'today' ? '<i class="tab-dot"></i>' : ''}
    </button>`).join('');
}

function renderView(c, e) {
  const view = $('#view');
  const active = document.activeElement;
  if (active && view.contains(active) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) {
    ui.pendingRender = true; // don't wipe what someone is typing
    return;
  }
  ui.pendingRender = false;
  let html;
  if (ui.tab === 'records') html = renderRecords(state, c, ui);
  else if (ui.tab === 'schedule') html = renderSchedule(state, c, ui);
  else if (ui.tab === 'settings') html = renderSettings(state, c, e);
  else html = renderToday(state, c, e);
  view.innerHTML = html;
  view.dataset.tab = ui.tab;
}

function renderOverlay(c, e) {
  const root = $('#overlay-root');
  if (!ui.ring) {
    root.innerHTML = '';
    root.dataset.key = '';
    document.body.classList.remove('is-alarm');
    return;
  }
  const doses = S.evaluateDay(S.ymd(c.now), c);
  root.classList.toggle('no-anim', root.dataset.key === ui.ring.key);
  root.dataset.key = ui.ring.key;
  root.innerHTML = renderAlarm(ui.ring, doses, c, e);
  document.body.classList.toggle('is-alarm', !!root.innerHTML);
}

function renderSheetRoot() {
  const c = ctx();
  const root = $('#sheet-root');
  // Only slide in when a new sheet opens, not when the open one updates.
  const kind = ui.sheet ? `${ui.sheet.type}:${ui.sheet.step || ''}` : '';
  root.classList.toggle('no-anim', !!kind && root.dataset.kind === kind);
  root.dataset.kind = kind;
  root.innerHTML = renderSheet(ui.sheet, state, c);
  document.body.classList.toggle('has-sheet', !!ui.sheet);
  const auto = $('#sheet-root [autofocus]');
  if (auto) setTimeout(() => auto.focus(), 50);
}

function render() {
  const c = ctx();
  const e = env();
  renderTopbar(c);
  renderView(c, e);
  renderTabbar(c);
  renderOverlay(c, e);
  updateLive(c.now);
}

// Countdowns and "in 20 min" texts, updated every second without a re-render.
function updateLive(now) {
  document.querySelectorAll('[data-until]').forEach((el) => {
    el.textContent = countdownText(Number(el.dataset.until) - now);
  });
  document.querySelectorAll('[data-rel]').forEach((el) => {
    el.textContent = relText(Number(el.dataset.rel) - now);
  });
  document.querySelectorAll('[data-gap-until]').forEach((el) => {
    const until = Number(el.dataset.gapUntil);
    const total = Number(el.dataset.gapTotal);
    const fg = el.querySelector('.ring-fg');
    if (!fg) return;
    const len = Number(fg.getAttribute('stroke-dasharray'));
    const pct = Math.max(0, Math.min(1, 1 - (until - now) / total));
    fg.setAttribute('stroke-dashoffset', (len * (1 - pct)).toFixed(2));
  });
}

// ---------------------------------------------------------------- the clock

function tick() {
  const now = Date.now();
  const c = ctx(now);
  const today = S.ymd(now);
  let ring = S.activeRing(c, state.acks, RING_MIN);

  // Alarm already stopped from the Android notification? Then it's silenced here too.
  const n = ring ? nativeInfo(1500) : null;
  if (ring && n && n.stoppedAt && n.stoppedAt >= ring.at) {
    store.ack(state, ring.key);
    store.save(state);
    ring = null;
  }

  handleRing(ring);

  const doses = S.evaluateDay(today, c);
  const sig = [
    today, ui.tab, Math.floor(now / 60000), ring ? ring.key : '',
    doses.map((d) => d.status + (d.snoozedUntil ? 's' : '') + (d.waitUntil ? 'w' : '')).join(''),
  ].join('|');
  if (sig !== ui.sig) {
    ui.sig = sig;
    render();
  } else {
    updateLive(now);
  }
}

function handleRing(ring) {
  if (ring) {
    if (!ui.ring || ui.ring.key !== ring.key) {
      ui.ring = ring;
      ui.soundBlocked = false;
      alarm.startRinging().then((ok) => {
        if (!ok && !alarm.isAndroidApp) {
          ui.soundBlocked = true;
          renderOverlay(ctx(), env());
        }
      });
      if (document.hidden) alarm.webNotify(ring.title, ring.text);
    }
  } else if (ui.ring) {
    ui.ring = null;
    ui.soundBlocked = false;
    alarm.stopRinging();
  }
}

// Hands the Android app the full list of upcoming alarms.
function syncNative() {
  if (!alarm.isAndroidApp) return;
  const c = ctx();
  const today = S.ymd(c.now);
  const { last } = S.courseBounds(c.meds);
  if (today > last) {
    alarm.syncNativeAlarms([]);
    return;
  }
  // The phone books one alarm per time: merge any that land on the same minute.
  const plan = [];
  for (const r of S.ringPlan(c, today, last)) {
    if (r.at <= c.now) continue;
    const prev = plan[plan.length - 1];
    if (prev && prev.at === r.at) prev.text = `${prev.text} Also: ${r.title}. ${r.text}`;
    else plan.push({ ...r });
  }
  alarm.syncNativeAlarms(plan);
  nativeCache = null; // "next alarm" in Settings changes with the new list
}

function commit() {
  store.save(state);
  syncNative();
  ui.sig = '';
  tick();
}

// ---------------------------------------------------------------- sheets & toasts

function openSheet(sheet) {
  ui.sheet = sheet;
  renderSheetRoot();
}

function closeSheet() {
  ui.sheet = null;
  renderSheetRoot();
  if (ui.pendingRender) render();
}

let toastTimer = null;
function toast(msg, { action, onAction, ms = 5000 } = {}) {
  const root = $('#toast-root');
  root.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}</div>`;
  const btn = root.querySelector('button');
  if (btn) {
    btn.addEventListener('click', () => {
      root.innerHTML = '';
      onAction?.();
    }, { once: true });
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, ms);
}

function confirmSheet(opts, onOk) {
  openSheet({ type: 'confirm', ...opts, onOk });
}

function dosesById(ids) {
  const c = ctx();
  const out = [];
  for (const id of ids) {
    const { date } = S.parseDoseId(id);
    const d = S.dosesForDate(date, c.meds).find((x) => x.id === id);
    if (d) out.push(d);
  }
  return out;
}

function openWho(ids, { purpose = 'done', when = null } = {}) {
  let title = 'Who put the drop?';
  if (purpose === 'pain') title = 'Who gave the pain tablet?';
  else {
    const doses = dosesById(ids);
    if (doses.length === 1) {
      title = doses[0].med.kind === 'tablet' ? 'Who gave the vitamin tablet?' : `Who put ${S.label(doses[0].med)}?`;
    }
  }
  openSheet({ type: 'who', ids, purpose, when, title });
}

function finishWho(name) {
  const sh = ui.sheet;
  if (!sh || sh.type !== 'who' || !name) return;
  const now = Date.now();
  let at = now;
  if (sh.when) {
    const date = sh.ids.length ? S.parseDoseId(sh.ids[0]).date : S.ymd(now);
    at = Math.min(now, S.atTime(date, sh.when));
  }
  if (sh.purpose === 'pain') {
    store.addPain(state, { at, by: name });
    closeSheet();
    commit();
    toast(`Pain tablet noted (${name}).`, { action: 'Undo', onAction: () => { store.removePain(state, at); commit(); } });
    return;
  }
  const before = Object.fromEntries(sh.ids.map((id) => [id, state.records[id]]));
  store.markDone(state, sh.ids, { at, by: name });
  if (ui.ring && ui.ring.ids.some((id) => sh.ids.includes(id))) store.ack(state, ui.ring.key);
  closeSheet();
  commit();
  const names = dosesById(sh.ids).map((d) => d.med.name).join(' + ');
  toast(`Ticked: ${names} by ${name}.`, {
    action: 'Undo',
    onAction: () => {
      for (const [id, r] of Object.entries(before)) {
        if (r) state.records[id] = r;
        else store.undo(state, id);
      }
      commit();
    },
  });
}

// ---------------------------------------------------------------- files

function stamp() {
  return S.ymd(Date.now());
}

async function saveFile(name, mime, text) {
  if (alarm.isAndroidApp) {
    alarm.nativeCall('saveFile', name, mime, text);
    return;
  }
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (alarm.isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

function pickBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json,text/plain';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const next = store.fromBackup(await file.text());
      const n = Object.keys(next.records).length;
      confirmSheet({
        title: 'Restore this backup?',
        text: `It has ${n} ticks. The records on this phone will be replaced.`,
        ok: 'Restore', danger: true,
      }, () => {
        state = next;
        state.settings.onboarded = true;
        commit();
        toast('Backup restored.');
      });
    } catch (err) {
      toast(err.message || 'Could not read that file.');
    }
  });
  input.click();
}

async function shareText(text) {
  if (alarm.isAndroidApp) {
    alarm.nativeCall('shareText', text);
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

// ---------------------------------------------------------------- actions

const ACTIONS = {
  tab(el) {
    ui.tab = el.dataset.tab;
    if (ui.tab === 'records') ui.openDay = null;
    ui.sig = '';
    render();
    window.scrollTo({ top: 0 });
  },
  done(el) {
    openWho(el.dataset.ids.split(','));
  },
  who(el) {
    finishWho(el.dataset.name);
  },
  snooze(el) {
    const ids = el.dataset.ids.split(',');
    const until = Date.now() + 5 * S.MIN;
    store.snooze(state, ids, until);
    if (ui.ring && ui.ring.ids.some((id) => ids.includes(id))) store.ack(state, ui.ring.key);
    commit();
    toast(`Okay. Ringing again at ${S.fmtClock(until)}.`);
  },
  skip(el) {
    const ids = el.dataset.ids.split(',');
    const names = dosesById(ids).map((d) => S.label(d.med)).join(', ');
    confirmSheet({
      title: `Skip ${names}?`,
      text: 'Only skip if the doctor said so. It will show as skipped in the records.',
      ok: 'Skip it', danger: true,
    }, () => {
      store.markSkipped(state, ids, state.settings.lastPerson);
      if (ui.ring && ui.ring.ids.some((id) => ids.includes(id))) store.ack(state, ui.ring.key);
      commit();
      toast('Marked as skipped.', { action: 'Undo', onAction: () => { ids.forEach((id) => store.undo(state, id)); commit(); } });
    });
  },
  early(el) {
    const ids = el.dataset.ids.split(',');
    const doses = dosesById(ids);
    confirmSheet({
      title: 'Put it early?',
      text: `${esc(doses.map((d) => S.label(d.med)).join(', '))} is due at <b>${S.fmtTime(doses[0].time)}</b>.`,
      ok: 'Yes, tick it now',
    }, () => setTimeout(() => openWho(ids), 0));
  },
  'dose-menu'(el) {
    openSheet({ type: 'dose', id: el.dataset.id });
  },
  'dose-undo'() {
    const id = ui.sheet.id;
    const prev = state.records[id];
    store.undo(state, id);
    closeSheet();
    commit();
    toast('Tick removed.', { action: 'Undo', onAction: () => { state.records[id] = prev; commit(); } });
  },
  'dose-fix'() {
    const id = ui.sheet.id;
    openWho([id], { when: S.parseDoseId(id).time });
  },
  'dose-retime'() {
    const id = ui.sheet.id;
    const r = state.records[id];
    openWho([id], { when: r ? S.hhmmOf(r.at) : null });
  },
  'pain-add'() {
    openWho([], { purpose: 'pain' });
  },
  'pain-remove'(el) {
    const at = Number(el.dataset.at);
    store.removePain(state, at);
    commit();
  },
  'day-toggle'(el) {
    const date = el.dataset.date;
    const today = S.ymd(Date.now());
    const isOpen = (ui.openDay || today) === date;
    ui.openDay = isOpen ? '-' : date;
    render();
  },
  'plan-day'(el) {
    ui.planDate = el.dataset.date;
    render();
  },
  'alarm-stop'() {
    if (ui.ring) store.ack(state, ui.ring.key);
    alarm.stopRinging();
    ui.tab = 'today';
    commit();
  },
  'alarm-snooze'() {
    if (!ui.ring) return;
    const c = ctx();
    const doses = S.evaluateDay(S.ymd(c.now), c).filter((d) => ['due', 'gap', 'queued'].includes(d.status));
    const ids = [...new Set([...ui.ring.ids, ...doses.map((d) => d.id)])];
    const until = Date.now() + 5 * S.MIN;
    store.snooze(state, ids, until);
    store.ack(state, ui.ring.key);
    alarm.stopRinging();
    commit();
    toast(`Okay. Ringing again at ${S.fmtClock(until)}.`);
  },
  'sheet-close'() {
    if (ui.sheet && ui.sheet.type === 'onboard') return;
    closeSheet();
  },
  'confirm-ok'() {
    const fn = ui.sheet && ui.sheet.onOk;
    closeSheet();
    fn?.();
  },
  'when-now'() {
    ui.sheet.when = null;
    renderSheetRoot();
  },
  'set-patient'(el) {
    state.settings.patientName = el.dataset.name;
    store.save(state);
    if (ui.sheet) renderSheetRoot();
    render();
  },
  'remove-person'(el) {
    store.removePerson(state, el.dataset.name);
    store.save(state);
    if (ui.sheet) renderSheetRoot();
    render();
  },
  'install-help'() {
    openSheet({ type: 'install' });
  },
  'unlock-sound'() {
    alarm.testSound();
    setTimeout(render, 400);
  },
  'test-sound'() {
    alarm.testSound();
    setTimeout(() => { render(); if (ui.sheet) renderSheetRoot(); }, 400);
  },
  'test-alarm'() {
    alarm.nativeCall('testAlarm', 60);
    toast('Test alarm in 1 minute. Lock the phone now and wait.', { ms: 8000 });
  },
  'native-fix'(el) {
    const which = el.dataset.which;
    if (which === 'notifications') alarm.nativeCall('requestNotifications');
    else alarm.nativeCall('openSettings', which);
  },
  'web-notify'() {
    alarm.askNotifications().then(() => render());
  },
  'export-json'() {
    saveFile(`drop-time-backup-${stamp()}.json`, 'application/json', store.toBackup(state));
  },
  'export-csv'() {
    saveFile(`drop-time-records-${stamp()}.csv`, 'text/csv', csvExport(ctx(), state));
  },
  'import-json'() {
    pickBackup();
  },
  'share-report'() {
    shareText(reportText(ctx(), state));
  },
  'reset-end'(el) {
    delete state.settings.endOverrides[el.dataset.med];
    commit();
  },
  'onboard-next'() {
    const input = document.querySelector('#sheet-root input[data-change="patientName"]');
    if (input) state.settings.patientName = input.value.trim() || 'Grandma';
    store.save(state);
    ui.sheet = { type: 'onboard', step: 2 };
    renderSheetRoot();
  },
  'onboard-allow'() {
    alarm.nativeCall('requestNotifications');
  },
  'onboard-finish'() {
    state.settings.onboarded = true;
    ui.sheet = null;
    renderSheetRoot();
    store.requestPersistence();
    commit();
  },
};

const SUBMITS = {
  'add-person'(form) {
    const input = form.querySelector('input[name="name"]');
    const name = store.addPerson(state, input.value);
    if (!name) return;
    store.save(state);
    if (ui.sheet) renderSheetRoot();
    else {
      input.value = '';
      input.blur();
      ui.pendingRender = false;
      render();
    }
    const again = document.querySelector('form[data-submit="add-person"] input');
    if (again && ui.sheet) again.focus();
  },
  'who-new'(form) {
    const name = store.addPerson(state, form.querySelector('input[name="name"]').value);
    if (name) finishWho(name);
  },
};

const CHANGES = {
  patientName(el) {
    state.settings.patientName = el.value.trim().slice(0, 30) || 'Grandma';
    store.save(state);
    renderTopbar(ctx());
  },
  endDate(el) {
    const med = el.dataset.med;
    if (!el.value) return;
    if (el.value === S.originalEnd(med)) delete state.settings.endOverrides[med];
    else state.settings.endOverrides[med] = el.value;
    el.blur();
    commit();
  },
  vitaminTime(el) {
    if (!el.value) return;
    state.settings.vitaminTime = el.value;
    el.blur();
    commit();
  },
  keepAwake(el) {
    state.settings.keepAwake = el.checked;
    alarm.setKeepAwake(el.checked);
    store.save(state);
  },
  whenTime(el) {
    if (!ui.sheet) return;
    ui.sheet.when = el.value || null;
    renderSheetRoot();
  },
};

function bindEvents() {
  document.addEventListener('click', (e) => {
    alarm.unlockSound();
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-submit]');
    if (!form) return;
    e.preventDefault();
    SUBMITS[form.dataset.submit]?.(form);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el) CHANGES[el.dataset.change]?.(el);
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      const a = document.activeElement;
      if (ui.pendingRender && !(a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName))) render();
    }, 0);
  });
  document.addEventListener('touchstart', () => alarm.unlockSound(), { passive: true, once: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.sheet && ui.sheet.type !== 'onboard') closeSheet();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      nativeCache = null;
      ui.sig = '';
      tick();
      syncNative();
    }
  });
  store.onExternalChange((next) => {
    state = next;
    ui.sig = '';
    tick();
  });
}

// Called by the Android app.
window.DropTime = {
  onNativeResume() {
    nativeCache = null;
    ui.sig = '';
    tick();
    syncNative();
  },
  onNativeAlarm() {
    nativeCache = null;
    ui.tab = 'today';
    ui.sig = '';
    tick();
    // Opened from an alarm the app doesn't show (test, snooze, already silenced): stop it.
    if (!ui.ring) alarm.nativeCall('stopRinging');
  },
  onBack() {
    if (ui.sheet && ui.sheet.type !== 'onboard') { closeSheet(); return true; }
    if (ui.tab !== 'today') { ui.tab = 'today'; ui.sig = ''; render(); return true; }
    return false;
  },
  onNativeSaved(ok) {
    toast(ok ? 'Saved.' : 'Not saved.');
  },
};

function registerServiceWorker() {
  if (alarm.isAndroidApp || !('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

function start() {
  alarm.initSound();
  if (state.settings.keepAwake) alarm.setKeepAwake(true);
  bindEvents();
  if (!state.settings.onboarded) ui.sheet = { type: 'onboard', step: 1 };
  render();
  renderSheetRoot();
  syncNative();
  tick();
  setInterval(tick, 1000);
  registerServiceWorker();
  if (state.settings.onboarded) store.requestPersistence();
}

start();
