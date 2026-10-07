// Small rendering helpers shared by all screens.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const ICONS = {
  drop: '<path fill="currentColor" stroke="none" d="M12 2.6c-.35 0-.66.18-.85.47C9.5 5.6 5.5 11.1 5.5 14.6a6.5 6.5 0 0 0 13 0c0-3.5-4-9-5.65-11.53A1 1 0 0 0 12 2.6z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  bell: '<path d="M18 16v-5a6 6 0 1 0-12 0v5l-1.6 2.2h15.2L18 16z"/><path d="M10 20.5a2.1 2.1 0 0 0 4 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r="1.1" fill="currentColor"/><circle cx="4.6" cy="12" r="1.1" fill="currentColor"/><circle cx="4.6" cy="17.5" r="1.1" fill="currentColor"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  phone: '<path d="M6.2 3.5h2.6l1.8 4.6-2.2 1.4a11.5 11.5 0 0 0 6.1 6.1l1.4-2.2 4.6 1.8v2.6a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.2 5.6a2 2 0 0 1 2-2.1z"/>',
  pill: '<rect x="2.8" y="8.2" width="18.4" height="7.6" rx="3.8" transform="rotate(-45 12 12)"/><path d="M8.9 8.9l6.2 6.2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  share: '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 13.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5"/>',
  download: '<path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5"/><path d="M5 20.5h14"/>',
  upload: '<path d="M12 20.5V9M7.5 13.5L12 9l4.5 4.5"/><path d="M5 3.5h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  warn: '<path d="M12 3.5l9.5 16.5h-19L12 3.5z"/><path d="M12 10v4.2M12 17.2v.1"/>',
  chevron: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  hourglass: '<path d="M7 3.5h10M7 20.5h10"/><path d="M8 3.5c0 4.5 8 4.8 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 4.8-8 8.5s8 4 8 8.5"/>',
  volume: '<path d="M4 9.5v5h3.5L12.5 19V5L7.5 9.5H4z"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a7.8 7.8 0 0 1 0 11.2"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  shake: '<path d="M8 4.5l-3 3 3 3M16 13.5l3 3-3 3"/><path d="M5 7.5h9a5 5 0 0 1 5 5M19 16.5h-9a5 5 0 0 1-5-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  android: '<path d="M7 10.5v6.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-6.5H7z"/><path d="M7 9.5a5 5 0 0 1 10 0H7z"/><path d="M9.5 18v2.5M14.5 18v2.5M4.5 11v4M19.5 11v4M8.5 4.5l1.2 1.8M15.5 4.5l-1.2 1.8"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

export function soft(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function medVars(med) {
  return `--c:${med.color};--c-soft:${soft(med.color, 0.13)};--c-line:${soft(med.color, 0.32)}`;
}

// Big circled number, same as the circle written on the box.
export function badge(med, size = '') {
  const inner = med.num ? med.num : icon('pill');
  return `<span class="num ${size}" style="${medVars(med)}" aria-hidden="true">${inner}</span>`;
}

export function medChip(med) {
  return `<span class="med-chip" style="${medVars(med)}">${badge(med, 'xs')}<span>${esc(med.name)}</span></span>`;
}

export function pluralize(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function countdownText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function relText(ms) {
  if (ms <= 0) return 'now';
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

export function ring(pct, size = 88, stroke = 9, cls = '') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/>
    <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}
