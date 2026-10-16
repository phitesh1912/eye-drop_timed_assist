// The Today screen: Put now / Coming up / Done.

import {
  REGIMEN, MIN, ymd, addDays, fmtDate, fmtTime, fmtClock, dayNumber, courseBounds, dosesForDate,
  evaluateDay, scheduleChanges, timesPerDayText, mealFor, label, PAIN_TABLET, NUMERALS, OPEN_STATUSES,
  eyeTag, dropTag, shortName,
} from './schedule.js';
import { esc, icon, badge, medChip, medVars, relText, countdownText, ring, pluralize } from './ui.js';

const OPEN = OPEN_STATUSES;

export function renderToday(state, c, env) {
  const today = ymd(c.now);
  const { first, last } = courseBounds(c.meds);
  const parts = [renderBanners(state, c, env, today)];

  if (today < first) {
    parts.push(renderBeforeStart(c, first));
    return parts.join('');
  }
  if (today > last) {
    parts.push(renderComplete(state, c, first, last));
    return parts.join('');
  }

  const doses = evaluateDay(today, c);
  parts.push(renderChangeBanner(c, today));
  parts.push(renderHero(doses, c, today));
  if (REGIMEN.ui === 'modern') parts.push(renderTimeline(doses, c));
  parts.push(renderNow(doses, c, env));
  parts.push(renderComingUp(doses, c, today, last));
  parts.push(renderDone(doses, c));
  parts.push(renderPain(state, c, today));
  return parts.join('');
}

// ---------------------------------------------------------------- banners

function renderBanners(state, c, env, today) {
  const out = [];
  if (env.saveFailed) {
    out.push(banner('warn', 'Couldn’t save on this phone', 'Ticks may be lost. Check that the phone isn’t in private browsing mode and has free space.'));
  }
  if (env.showInstall) {
    out.push(`<button class="banner banner-brand" data-act="install-help">
      ${icon('download')}<div><b>Add ${esc(REGIMEN.title)} to your Home Screen</b><span>Needed on iPhone so the records stay saved. Tap for the 3 steps.</span></div>${icon('chevron', 'chev')}
    </button>`);
  }
  if (env.showCalendarTip) {
    out.push(`<div class="banner banner-brand banner-cal">
      ${icon('calendar')}<div><b>Get alerts even when the app is closed</b><span>Add every drop time to the iPhone Calendar, then tap “Add All”.</span>
        <div class="banner-actions">
          <a class="btn btn-small" href="calendar/drop-time.ics" target="_blank" rel="noopener" data-mark="calendarAdded">${icon('calendar')} Add to Calendar</a>
          <button class="link-btn" data-act="calendar-later">Not now</button>
        </div>
      </div>
    </div>`);
  }
  if (env.soundLocked) {
    out.push(`<button class="banner banner-wait" data-act="unlock-sound">
      ${icon('volume')}<div><b>Tap here to turn on the alarm sound</b><span>Phones only allow sound after the screen is touched once.</span></div>
    </button>`);
  }
  if (env.alarmProblem) {
    out.push(`<button class="banner banner-warn" data-act="tab" data-tab="settings">
      ${icon('warn')}<div><b>Alarms may not ring</b><span>${esc(env.alarmProblem)} Tap to fix.</span></div>${icon('chevron', 'chev')}
    </button>`);
  }
  return out.join('');
}

function banner(kind, title, text) {
  return `<div class="banner banner-${kind}">${icon(kind === 'warn' ? 'warn' : 'info')}<div><b>${esc(title)}</b><span>${esc(text)}</span></div></div>`;
}

export function changeLine(item) {
  const name = `<b>${esc(item.med.name)}</b>`;
  if (item.type === 'stop') return `${name} stops`;
  if (item.type === 'start') return `${name} starts · ${timesPerDayText(item.times.length)}`;
  return `${name} changes to ${timesPerDayText(item.times.length)}`;
}

function renderChangeBanner(c, today) {
  const { first } = courseBounds(c.meds);
  const changes = scheduleChanges(c.meds).filter((ch) => ch.date !== first);
  const tomorrow = addDays(today, 1);
  // Today's changes and tomorrow's, so the evening before a switch already shows it.
  const hits = changes.filter((ch) => ch.date === today || ch.date === tomorrow);
  if (!hits.length) return '';
  return `<section class="change-banner">${hits.map((hit) => `
    <div class="change-kicker">${icon('calendar')} ${hit.date === today ? 'Today' : 'Tomorrow'} · ${esc(fmtDate(hit.date))}</div>
    <ul>${hit.items.map((it) => `<li style="${medVars(it.med)}">${badge(it.med, 'xs')}<span>${changeLine(it)}</span></li>`).join('')}</ul>`).join('')}
  </section>`;
}

// ---------------------------------------------------------------- hero

function renderHero(doses, c, today) {
  const drops = doses.filter((d) => d.med.kind === 'drop');
  const doneDrops = drops.filter((d) => d.status === 'done').length;
  const pct = drops.length ? doneDrops / drops.length : 0;
  const open = doses.filter((d) => OPEN.includes(d.status));
  const next = doses.find((d) => d.status === 'upcoming');
  const tablets = doses.filter((d) => d.med.kind === 'tablet');

  let line;
  if (open.length) {
    const head = open.find((d) => d.med.kind === 'drop') || open[0];
    line = head.med.kind === 'tablet'
      ? `<div class="hero-next is-now">${icon('pill')} Give now: <b>${esc(head.med.name)}</b></div>`
      : head.status === 'gap'
      ? `<div class="hero-next is-wait">${icon('hourglass')} Next: <b>${esc(label(head.med))}</b></div>
        <div class="hero-rel is-wait">after the ${c.gapMin}-min gap · <b data-until="${head.waitUntil}">${countdownText(head.waitUntil - c.now)}</b></div>`
      : `<div class="hero-next is-now">${icon('bell')} Put now: <b>${esc(label(head.med))}</b></div>`;
  } else if (next) {
    line = `<div class="hero-next">Next: <b>${fmtTime(next.time)}</b> · ${esc(label(next.med))}</div>
      <div class="hero-rel" data-rel="${next.at}">${relText(next.at - c.now)}</div>`;
  } else {
    line = `<div class="hero-next is-done">${icon('check')} All done for today</div>`;
  }

  return `<section class="card hero">
    <div class="hero-ring">${ring(pct, 96, 10, doneDrops === drops.length && drops.length ? 'is-full' : '')}
      <div class="hero-count"><b>${doneDrops}</b><span>of ${drops.length}</span></div>
    </div>
    <div class="hero-text">
      <div class="hero-label">eye drops done today</div>
      ${line}
      ${tabletChip(tablets)}
    </div>
  </section>`;
}

function tabletChip(tablets) {
  if (!tablets.length) return '';
  if (tablets.length === 1) {
    const t = tablets[0];
    const done = t.status === 'done';
    const name = shortName(t.med);
    return `<div class="hero-vit ${done ? 'ok' : ''}">${icon(done ? 'check' : 'pill')} ${esc(name)} ${done ? 'taken' : fmtTime(t.time)}</div>`;
  }
  const done = tablets.filter((t) => t.status === 'done').length;
  const all = done === tablets.length;
  return `<div class="hero-vit ${all ? 'ok' : ''}">${icon(all ? 'check' : 'pill')} Tablets ${done} of ${tablets.length}</div>`;
}

// A swipeable strip of today's times (modern design only).
function renderTimeline(doses, c) {
  const groups = [];
  for (const d of doses) {
    const g = groups.find((x) => x.time === d.time);
    if (g) g.doses.push(d);
    else groups.push({ time: d.time, at: d.at, doses: [d] });
  }
  if (!groups.length) return '';
  const currentIdx = (() => {
    const open = groups.findIndex((g) => g.doses.some((d) => OPEN.includes(d.status)));
    if (open >= 0) return open;
    const up = groups.findIndex((g) => g.doses.some((d) => d.status === 'upcoming'));
    return up >= 0 ? up : groups.length - 1;
  })();
  const chips = groups.map((g, i) => {
    const st = g.doses.every((d) => d.status === 'done') ? 'done'
      : g.doses.some((d) => d.status === 'missed') ? 'missed'
        : g.doses.some((d) => OPEN.includes(d.status)) ? 'now'
          : g.doses.every((d) => ['done', 'skipped'].includes(d.status)) ? 'done' : 'later';
    const [hm, ap] = fmtTime(g.time).split(' ');
    const mark = st === 'done' ? icon('check') : st === 'missed' ? icon('x') : '';
    return `<div class="tl-chip st-${st} ${i === currentIdx ? 'is-current' : ''}" data-tl="${i}">
      <span class="tl-time">${hm}<small>${ap}</small></span>
      <span class="tl-badges">${g.doses.map((d) => badge(d.med, 'xs')).join('')}</span>
      <span class="tl-mark">${mark}</span>
    </div>`;
  }).join('');
  return `<section class="tl-wrap" aria-label="Today's times"><div class="tl-strip" data-current="${currentIdx}">${chips}</div></section>`;
}

// ---------------------------------------------------------------- put now

function tags(d) {
  if (d.med.kind === 'tablet') {
    return `<span class="tag">${icon('pill')} 1 tablet</span><span class="tag">${esc(mealFor(d.time, d.med))}</span>`;
  }
  return `<span class="tag tag-eye">${icon('eye')} ${esc(eyeTag())}</span>
    <span class="tag">${icon('drop')} ${esc(dropTag())}</span>
    ${d.med.shake ? `<span class="tag tag-shake">${icon('shake')} Shake well</span>` : ''}`;
}

function statusLine(d, c) {
  if (d.snoozedUntil) {
    return `<div class="dose-status is-snooze">${icon('clock')} Snoozed · rings again at ${fmtClock(d.snoozedUntil)}</div>`;
  }
  if (d.lateMin > c.onTimeMin) {
    return `<div class="dose-status is-late">${icon('warn')} Late by ${d.lateMin >= 60 ? `${Math.floor(d.lateMin / 60)} h ${d.lateMin % 60} min` : `${d.lateMin} min`}</div>`;
  }
  return `<div class="dose-status is-now">${icon('bell')} Due now${d.lateMin > 0 ? ` · ${d.lateMin} min ago` : ''}</div>`;
}

function doseHeader(d, size = 'lg') {
  const [hm, ap] = fmtTime(d.time).split(' ');
  return `<div class="dose-main">
    ${badge(d.med, size)}
    <div class="dose-info">
      <div class="dose-name">${esc(d.med.name)}</div>
      <div class="dose-sub">${esc(d.med.generic)}</div>
      <div class="dose-box"><i class="swatch"></i>${esc(d.med.box)}</div>
    </div>
    <div class="dose-time"><b>${hm}</b><small>${ap}</small></div>
  </div>`;
}

function dueCard(d, c, isRinging) {
  const ids = esc(d.id);
  if (d.status === 'gap') {
    const total = c.gapMin * MIN;
    const left = d.waitUntil - c.now;
    return `<article class="dose-card is-gap" style="${medVars(d.med)}">
      ${doseHeader(d)}
      <div class="dose-tags">${tags(d)}</div>
      <div class="gap-box">
        <div class="gap-ring" data-gap-until="${d.waitUntil}" data-gap-total="${total}">
          ${ring(1 - left / total, 74, 8, 'is-wait')}
          <b data-until="${d.waitUntil}" data-fmt="mmss">${countdownText(left)}</b>
        </div>
        <div class="gap-text"><b>Wait ${c.gapMin} minutes between drops</b><span>So the last drop isn’t washed out. It will ring when it’s time.</span></div>
      </div>
      <div class="dose-actions"><button class="btn btn-soft wide" data-act="done" data-ids="${ids}" data-early-gap="1">${icon('check')} Already put it</button></div>
    </article>`;
  }
  return `<article class="dose-card is-due ${isRinging ? 'is-ringing' : ''}" style="${medVars(d.med)}">
    ${doseHeader(d)}
    <div class="dose-tags">${tags(d)}</div>
    ${statusLine(d, c)}
    <div class="dose-actions">
      <button class="btn btn-done wide" data-act="done" data-ids="${ids}">${icon('check')} Done, ${d.med.kind === 'tablet' ? 'tablet given' : 'drop put'}</button>
      <div class="btn-row">
        <button class="btn btn-soft" data-act="snooze" data-ids="${ids}">${icon('clock')} 5 min later</button>
        <button class="btn btn-quiet" data-act="skip" data-ids="${ids}">Skip</button>
      </div>
    </div>
  </article>`;
}

function queuedCard(d, c) {
  return `<article class="queued-card" style="${medVars(d.med)}">
    <div class="queued-then">then</div>
    ${badge(d.med, 'md')}
    <div class="queued-info"><b>${esc(d.med.name)}</b><span>${esc(d.med.box)} · ${c.gapMin} min after the drop above</span></div>
    <div class="queued-side"><span class="queued-time">${fmtTime(d.time)}</span>
      <button class="link-btn" data-act="done" data-ids="${esc(d.id)}">Already put</button></div>
  </article>`;
}

function renderNow(doses, c, env) {
  const open = doses.filter((d) => OPEN.includes(d.status));
  if (!open.length) return '';
  const ringingIds = new Set(env.ringIds || []);
  const drops = open.filter((d) => d.med.kind === 'drop');
  const tablets = open.filter((d) => d.med.kind === 'tablet');
  const cards = [];
  drops.forEach((d) => {
    cards.push(d.status === 'queued' ? queuedCard(d, c) : dueCard(d, c, ringingIds.has(d.id)));
  });
  tablets.forEach((d) => cards.push(dueCard(d, c, ringingIds.has(d.id))));
  return `<section class="section">
    <h2 class="section-title t-now"><span class="dot-live"></span>Put now</h2>
    <div class="stack">${cards.join('')}</div>
  </section>`;
}

// ---------------------------------------------------------------- coming up

function renderComingUp(doses, c, today, last) {
  const upcoming = doses.filter((d) => d.status === 'upcoming');
  const groups = [];
  for (const d of upcoming) {
    const g = groups.find((x) => x.time === d.time);
    if (g) g.doses.push(d);
    else groups.push({ time: d.time, at: d.at, doses: [d] });
  }
  let rows;
  if (groups.length) {
    rows = groups.map((g, i) => {
      const [hm, ap] = fmtTime(g.time).split(' ');
      const soon = i === 0 && g.at - c.now <= 30 * MIN;
      return `<div class="up-row ${i === 0 ? 'is-next' : ''}">
        <div class="up-time"><b>${hm}</b><small>${ap}</small></div>
        <div class="up-meds">${g.doses.map((d) => medChip(d.med)).join('')}
          ${g.doses.length > 1 && g.doses.some((d) => d.med.kind === 'drop') ? `<span class="up-note">${c.gapMin} min apart</span>` : ''}
        </div>
        <div class="up-side">
          <span class="up-rel" data-rel="${g.at}">${relText(g.at - c.now)}</span>
          ${soon ? `<button class="link-btn" data-act="early" data-ids="${esc(g.doses.map((d) => d.id).join(','))}">Put early</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } else {
    const tomorrow = addDays(today, 1);
    const next = tomorrow <= last ? dosesForDate(tomorrow, c.meds)[0] : null;
    rows = `<div class="empty-note">${icon('moon')}<div><b>No more drops today.</b>${next ? `<span>Tomorrow starts at ${fmtTime(next.time)} with ${esc(label(next.med))}.</span>` : '<span>That was the last day of the course.</span>'}</div></div>`;
  }
  return `<section class="section">
    <h2 class="section-title t-up">${icon('clock')}Coming up</h2>
    <div class="card list-card">${rows}</div>
  </section>`;
}

// ---------------------------------------------------------------- done

function timingPill(d) {
  if (d.timing === 'late') return `<span class="pill pill-late">${icon('clock')} ${d.delayMin} min late</span>`;
  if (d.timing === 'early') return `<span class="pill pill-late">${icon('clock')} ${-d.delayMin} min early</span>`;
  return `<span class="pill pill-ok">${icon('check')} On time</span>`;
}

export function doneRow(d) {
  const who = d.by ? `<span class="row-by">${esc(d.by)}</span>` : '';
  if (d.status === 'done') {
    return `<button class="row is-done" data-act="dose-menu" data-id="${esc(d.id)}">
      <span class="row-mark ok">${icon('check')}</span>
      <span class="row-time">${fmtClock(d.doneAt)}</span>
      <span class="row-med">${medChip(d.med)}</span>
      <span class="row-meta">${who}${timingPill(d)}</span>
    </button>`;
  }
  if (d.status === 'skipped') {
    return `<button class="row is-skipped" data-act="dose-menu" data-id="${esc(d.id)}">
      <span class="row-mark skip">${icon('x')}</span>
      <span class="row-time">${fmtTime(d.time)}</span>
      <span class="row-med">${medChip(d.med)}</span>
      <span class="row-meta">${who}<span class="pill pill-skip">Skipped</span></span>
    </button>`;
  }
  if (d.status === 'missed') {
    return `<button class="row is-missed" data-act="dose-menu" data-id="${esc(d.id)}">
      <span class="row-mark miss">${icon('warn')}</span>
      <span class="row-time">${fmtTime(d.time)}</span>
      <span class="row-med">${medChip(d.med)}</span>
      <span class="row-meta"><span class="pill pill-miss">Missed</span></span>
    </button>`;
  }
  return '';
}

function renderDone(doses, c) {
  const done = doses.filter((d) => ['done', 'skipped', 'missed'].includes(d.status));
  if (!done.length) return '';
  done.sort((a, b) => (b.doneAt || b.at) - (a.doneAt || a.at));
  const missed = done.filter((d) => d.status === 'missed').length;
  return `<section class="section">
    <h2 class="section-title t-done">${icon('check')}Done today <span class="count">${pluralize(done.filter((d) => d.status === 'done').length, 'tick')}${missed ? ` · ${missed} missed` : ''}</span></h2>
    <div class="card list-card">${done.map(doneRow).join('')}</div>
  </section>`;
}

// ---------------------------------------------------------------- pain tablet

export function painToday(state, date) {
  return state.pain.filter((p) => ymd(p.at) === date);
}

function renderPain(state, c, today) {
  const list = painToday(state, today);
  const full = list.length >= PAIN_TABLET.maxPerDay;
  const med = { ...PAIN_TABLET, num: 0 };
  return `<section class="section">
    <div class="card pain-card" style="${medVars(med)}">
      <div class="pain-head">${badge(med, 'md')}
        <div><b>Pain tablet</b><span>${esc(PAIN_TABLET.generic)} · only if there is pain, at most ${PAIN_TABLET.maxPerDay} a day</span></div>
        <div class="pain-count"><b>${list.length}</b>/${PAIN_TABLET.maxPerDay}</div>
      </div>
      ${list.map((p) => `<div class="pain-row">${icon('check')}<span>${fmtClock(p.at)}${p.by ? ` · ${esc(p.by)}` : ''}</span><button class="link-btn" data-act="pain-remove" data-at="${p.at}">Undo</button></div>`).join('')}
      <button class="btn btn-soft wide" data-act="pain-add" ${full ? 'disabled' : ''}>${full ? `Already ${PAIN_TABLET.maxPerDay} today` : `${icon('plus')} Gave a pain tablet`}</button>
    </div>
  </section>`;
}

// ---------------------------------------------------------------- before / after

export function timetableRows(date, meds, gapMin) {
  const doses = dosesForDate(date, meds);
  const groups = [];
  for (const d of doses) {
    const key = d.med.kind === 'drop' ? `drop@${d.time}` : `${d.med.id}@${d.time}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.doses.push(d);
    else groups.push({ key, time: d.time, doses: [d] });
  }
  groups.sort((a, b) => a.time.localeCompare(b.time));
  return groups.map((g) => {
    const [hm, ap] = fmtTime(g.time).split(' ');
    return `<div class="up-row">
      <div class="up-time"><b>${hm}</b><small>${ap}</small></div>
      <div class="up-meds">${g.doses.map((d) => medChip(d.med)).join('')}
        ${g.doses.length > 1 ? `<span class="up-note">${gapMin} min apart</span>` : ''}</div>
    </div>`;
  }).join('');
}

function renderBeforeStart(c, first) {
  const doses = dosesForDate(first, c.meds);
  const firstDose = doses[0];
  const drops = doses.filter((d) => d.med.kind === 'drop');
  const days = Math.round((new Date(`${first}T00:00`) - new Date(`${ymd(c.now)}T00:00`)) / 86400000);
  return `<section class="card start-card">
    <div class="start-art">${icon('drop')}</div>
    <div class="start-kicker">Day ${dayNumber(ymd(c.now))} · surgery day</div>
    <h2>${days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`}</h2>
    <p>First drop at <b>${fmtTime(firstDose.time)}</b> on <b>${esc(fmtDate(first))}</b>: ${esc(label(firstDose.med))}.</p>
    <p class="muted">The alarms are set. Today’s hourly drops from the hospital aren’t tracked in the app.</p>
  </section>
  <section class="section">
    <h2 class="section-title t-up">${icon('calendar')}${esc(fmtDate(first))} · ${drops.length} drops</h2>
    <div class="card list-card">${timetableRows(first, c.meds, c.gapMin)}</div>
  </section>`;
}

function renderComplete(state, c, first, last) {
  let done = 0;
  for (const r of Object.values(state.records)) if (r.s === 'done') done++;
  return `<section class="card start-card is-complete">
    <div class="start-art">${icon('star')}</div>
    <div class="start-kicker">${esc(fmtDate(first))} – ${esc(fmtDate(last))}</div>
    <h2>The course is complete!</h2>
    <p>${esc(state.settings.patientName)} finished every drop on the hospital sheet. ${done} ticks recorded.</p>
    <button class="btn btn-soft wide" data-act="tab" data-tab="records">${icon('list')} See all records</button>
  </section>`;
}

export { NUMERALS };
