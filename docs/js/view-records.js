// Records: every day so far, what was put, when and by whom.

import { ymd, addDays, fmtDate, fmtTime, fmtClock, courseBounds, summarizeDay } from './schedule.js';
import { esc, icon, medChip } from './ui.js';
import { painToday } from './view-today.js';

const STATUS = {
  perfect: { cls: 'ok', icon: 'check', text: 'All on time' },
  late: { cls: 'late', icon: 'clock', text: 'All done, some late' },
  missed: { cls: 'miss', icon: 'warn', text: 'Missed some' },
  progress: { cls: 'now', icon: 'hourglass', text: 'In progress' },
  future: { cls: 'muted', icon: 'calendar', text: 'Coming' },
  none: { cls: 'muted', icon: 'info', text: 'No drops' },
};

export function allDays(c) {
  const { first, last } = courseBounds(c.meds);
  const today = ymd(c.now);
  const end = today < last ? today : last;
  const out = [];
  for (let d = first; d <= end; d = addDays(d, 1)) out.push(summarizeDay(d, c));
  return out;
}

function statusPill(s) {
  const st = STATUS[s.status];
  let text = st.text;
  if (s.status === 'missed') text = `${s.missed} missed`;
  if (s.status === 'late') text = `All done · ${s.late + s.early} not on time`;
  if (s.status === 'progress') {
    const drops = s.doses.filter((d) => d.med.kind === 'drop');
    text = `${drops.filter((d) => d.status === 'done').length} of ${drops.length} drops so far`;
  }
  return `<span class="pill pill-${st.cls}">${icon(st.icon)} ${esc(text)}</span>`;
}

function dot(d) {
  const st = d.status === 'done' ? (d.timing === 'ontime' ? 'ok' : 'late') : d.status;
  return `<i class="dot dot-${st}" title="${esc(`${fmtTime(d.time)} ${d.med.name}: ${d.status}`)}"></i>`;
}

function doseLine(d) {
  let state;
  if (d.status === 'done') {
    const t = d.timing === 'ontime' ? 'on time' : d.timing === 'late' ? `${d.delayMin} min late` : `${-d.delayMin} min early`;
    state = `<span class="rec-state ${d.timing === 'ontime' ? 'ok' : 'late'}">${icon('check')} ${fmtClock(d.doneAt)}${d.by ? ` · ${esc(d.by)}` : ''} · ${t}</span>`;
  } else if (d.status === 'missed') {
    state = `<span class="rec-state miss">${icon('warn')} Missed</span>`;
  } else if (d.status === 'skipped') {
    state = `<span class="rec-state muted">${icon('x')} Skipped${d.by ? ` · ${esc(d.by)}` : ''}</span>`;
  } else if (d.status === 'upcoming') {
    state = '<span class="rec-state muted">Later</span>';
  } else {
    state = `<span class="rec-state now">${icon('bell')} Due now</span>`;
  }
  const clickable = ['done', 'missed', 'skipped'].includes(d.status);
  return `<${clickable ? `button data-act="dose-menu" data-id="${esc(d.id)}"` : 'div'} class="rec-line">
    <span class="rec-time">${fmtTime(d.time)}</span>
    <span class="rec-med">${medChip(d.med)}</span>
    ${state}
  </${clickable ? 'button' : 'div'}>`;
}

function painLine(p) {
  return `<div class="rec-line"><span class="rec-time">${fmtClock(p.at)}</span><span class="rec-med"><span class="med-chip plain">Pain tablet</span></span><span class="rec-state ok">${icon('check')} Given${p.by ? ` · ${esc(p.by)}` : ''}</span></div>`;
}

// Everything that happened that day in time order; drops still to come are summed up in one line.
function dayLines(s, pain) {
  const items = s.doses.filter((d) => d.status !== 'upcoming').map((d) => ({ at: d.at, html: doseLine(d) }));
  for (const p of pain) items.push({ at: p.at, html: painLine(p) });
  items.sort((a, b) => a.at - b.at);
  const later = s.doses.filter((d) => d.status === 'upcoming');
  if (later.length) {
    items.push({ html: `<div class="rec-line rec-later"><span class="rec-time">Later</span><span class="rec-med muted">${later.length} more today, next at ${fmtTime(later[0].time)}</span></div>` });
  }
  return items.map((i) => i.html).join('');
}

function dayCard(s, open, state) {
  const drops = s.doses.filter((d) => d.med.kind === 'drop');
  const dropsDone = drops.filter((d) => d.status === 'done').length;
  const vit = s.doses.find((d) => d.med.kind === 'tablet');
  const pain = painToday(state, s.date);
  return `<article class="day-card ${open ? 'is-open' : ''} st-${s.status}">
    <button class="day-head" data-act="day-toggle" data-date="${s.date}" aria-expanded="${open}">
      <div class="day-date"><b>${esc(fmtDate(s.date))}</b><span>Day ${s.day}</span></div>
      ${statusPill(s)}
      ${icon('chevron', 'chev')}
    </button>
    <div class="day-sum">
      <span>${icon('drop')} ${dropsDone}/${drops.length} drops</span>
      ${vit ? `<span>${icon('pill')} Vitamin ${vit.status === 'done' ? '✓' : vit.status === 'missed' ? '✗' : '–'}</span>` : ''}
      ${pain.length ? `<span>${icon('pill')} Pain tablet ×${pain.length}</span>` : ''}
    </div>
    <div class="dots" aria-hidden="true">${s.doses.map(dot).join('')}</div>
    ${open ? `<div class="day-body">${dayLines(s, pain)}</div>` : ''}
  </article>`;
}

export function renderRecords(state, c, ui) {
  const days = allDays(c);
  const today = ymd(c.now);
  if (!days.length) {
    const { first } = courseBounds(c.meds);
    return `<section class="card start-card"><div class="start-art">${icon('list')}</div>
      <h2>No records yet</h2><p>Records start on ${esc(fmtDate(first))}. Every tick shows up here: what was put, when, and by whom.</p></section>
      ${exportCard()}`;
  }

  let done = 0; let ontime = 0; let missed = 0; let perfectDays = 0; let finished = 0;
  for (const s of days) {
    done += s.done; ontime += s.ontime; missed += s.missed;
    if (s.date < today || s.status === 'perfect' || s.status === 'late') {
      finished++;
      if (s.status === 'perfect') perfectDays++;
    }
  }
  const pct = done ? Math.round((ontime / done) * 100) : 0;
  const openDate = ui.openDay || today;

  return `<section class="stats">
      <div class="stat"><b>${done}</b><span>ticks</span></div>
      <div class="stat"><b>${done ? `${pct}%` : '–'}</b><span>on time</span></div>
      <div class="stat ${missed ? 'is-miss' : ''}"><b>${missed}</b><span>missed</span></div>
      <div class="stat"><b>${finished ? `${perfectDays}<small>/${finished}</small>` : '–'}</b><span>perfect days</span></div>
    </section>
    <section class="section">
      <h2 class="section-title">${icon('list')}Day by day</h2>
      <div class="stack">${days.slice().reverse().map((s) => dayCard(s, s.date === openDate, state)).join('')}</div>
    </section>
    ${exportCard()}`;
}

function exportCard() {
  return `<section class="section">
    <h2 class="section-title">${icon('download')}Keep a copy</h2>
    <div class="card action-list">
      <button class="action" data-act="share-report">${icon('share')}<div><b>Share today’s report</b><span>A short message for the family WhatsApp group</span></div></button>
      <button class="action" data-act="export-csv">${icon('download')}<div><b>Save records for the doctor</b><span>Spreadsheet file (CSV) with every drop</span></div></button>
      <button class="action" data-act="export-json">${icon('download')}<div><b>Save a backup</b><span>To move the records to another phone</span></div></button>
      <button class="action" data-act="import-json">${icon('upload')}<div><b>Restore a backup</b><span>Replaces the records on this phone</span></div></button>
    </div>
  </section>`;
}

export function csvExport(c, state) {
  const rows = [['Date', 'Day', 'Due', 'Medicine', 'Number', 'Status', 'Put at', 'Put by', 'Minutes late']];
  for (const s of allDays(c)) {
    for (const d of s.doses) {
      rows.push([
        s.date, s.day, fmtTime(d.time), d.med.name, d.med.num || '', d.status,
        d.doneAt ? fmtClock(d.doneAt) : '', d.by || '', d.status === 'done' ? d.delayMin : '',
      ]);
    }
    for (const p of painToday(state, s.date)) {
      rows.push([s.date, s.day, '', 'Pain tablet (Dolo 650 / Ultracet)', '', 'done', fmtClock(p.at), p.by || '', '']);
    }
  }
  return rows.map((r) => r.map((v) => {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  }).join(',')).join('\n');
}

export function reportText(c, state) {
  const today = ymd(c.now);
  const s = summarizeDay(today, c);
  const drops = s.doses.filter((d) => d.med.kind === 'drop');
  const put = drops.filter((d) => d.status === 'done');
  const late = put.filter((d) => d.timing !== 'ontime').length;
  const missed = drops.filter((d) => d.status === 'missed');
  const vit = s.doses.find((d) => d.med.kind === 'tablet');
  const people = [...new Set(s.doses.map((d) => d.by).filter(Boolean))];
  const lines = [
    `💧 ${state.settings.patientName}’s eye drops · ${fmtDate(today)} (Day ${s.day})`,
    `${put.length === drops.length ? '✅' : '⏳'} ${put.length} of ${drops.length} drops put${put.length ? (late ? ` (${late} late)` : ' (all on time)') : ''}`,
  ];
  if (missed.length) lines.push(`⚠️ Missed: ${missed.map((d) => `${fmtTime(d.time)} ${d.med.name}`).join(', ')}`);
  if (vit) lines.push(`💊 Vitamin: ${vit.status === 'done' ? 'taken ✓' : vit.status === 'missed' ? 'missed' : 'not yet'}`);
  const pain = painToday(state, today);
  if (pain.length) lines.push(`💊 Pain tablet: ${pain.length} given`);
  if (people.length) lines.push(`🙏 Put by ${people.join(', ')}`);
  return lines.join('\n');
}
