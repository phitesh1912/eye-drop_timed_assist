// Saved data: settings, who put which drop when, snoozes, silenced alarms.
// Everything lives on this phone (localStorage). Backups are plain JSON files.

import { COURSE, MIN } from './schedule.js';

const KEY = 'droptime:v1';

export const DEFAULT_SETTINGS = {
  patientName: 'Grandma',
  people: [],
  lastPerson: '',
  hospitalPhone: COURSE.hospitalPhone,
  onTimeMin: 30,
  gapMin: 5,
  nagMins: [10, 20],
  vitaminTime: '09:00',
  endOverrides: {},
  sound: true,
  keepAwake: false,
  onboarded: false,
};

function fresh() {
  return {
    v: 1,
    settings: { ...DEFAULT_SETTINGS, people: [], endOverrides: {} },
    records: {}, // doseId -> { s: 'done' | 'skipped', at, by, t }
    pain: [],    // [{ at, by }]
    snoozes: {}, // doseId -> until
    acks: {},    // alarm key -> when it was silenced
    createdAt: Date.now(),
  };
}

function normalize(raw) {
  const base = fresh();
  if (!raw || typeof raw !== 'object') return base;
  const settings = { ...base.settings, ...(raw.settings || {}) };
  if (!Array.isArray(settings.people)) settings.people = [];
  settings.people = settings.people.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim());
  if (!settings.endOverrides || typeof settings.endOverrides !== 'object') settings.endOverrides = {};
  if (!Array.isArray(settings.nagMins)) settings.nagMins = [...DEFAULT_SETTINGS.nagMins];
  return {
    ...base,
    ...raw,
    settings,
    records: raw.records && typeof raw.records === 'object' ? raw.records : {},
    pain: Array.isArray(raw.pain) ? raw.pain : [],
    snoozes: raw.snoozes && typeof raw.snoozes === 'object' ? raw.snoozes : {},
    acks: raw.acks && typeof raw.acks === 'object' ? raw.acks : {},
  };
}

let saveError = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : fresh();
  } catch {
    return fresh();
  }
}

export function save(state) {
  prune(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveError = null;
    return true;
  } catch (e) {
    saveError = e;
    return false;
  }
}

export function lastSaveFailed() {
  return !!saveError;
}

// Ask the browser not to clear our data when space is low.
export function requestPersistence() {
  try {
    navigator.storage?.persist?.();
  } catch { /* not supported */ }
}

function prune(state) {
  const cutoff = Date.now() - 3 * 24 * 60 * MIN;
  for (const [k, v] of Object.entries(state.acks)) if (v < cutoff) delete state.acks[k];
  for (const [k, v] of Object.entries(state.snoozes)) if (v < cutoff) delete state.snoozes[k];
}

export function onExternalChange(fn) {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) fn(load());
  });
}

// ---------------------------------------------------------------- changes

export function markDone(state, ids, { at, by }) {
  const t = Date.now();
  for (const id of ids) {
    state.records[id] = { s: 'done', at, by, t };
    delete state.snoozes[id];
  }
  if (by) state.settings.lastPerson = by;
}

export function markSkipped(state, ids, by) {
  const t = Date.now();
  for (const id of ids) {
    state.records[id] = { s: 'skipped', at: t, by, t };
    delete state.snoozes[id];
  }
}

export function undo(state, id) {
  delete state.records[id];
}

export function snooze(state, ids, until) {
  for (const id of ids) state.snoozes[id] = until;
}

export function ack(state, key) {
  state.acks[key] = Date.now();
}

export function addPain(state, { at, by }) {
  state.pain.push({ at, by });
  state.pain.sort((a, b) => a.at - b.at);
  if (by) state.settings.lastPerson = by;
}

export function removePain(state, at) {
  state.pain = state.pain.filter((p) => p.at !== at);
}

export function addPerson(state, name) {
  const n = String(name || '').trim().slice(0, 30);
  if (!n) return '';
  if (!state.settings.people.some((p) => p.toLowerCase() === n.toLowerCase())) state.settings.people.push(n);
  return n;
}

export function removePerson(state, name) {
  state.settings.people = state.settings.people.filter((p) => p !== name);
  if (state.settings.lastPerson === name) state.settings.lastPerson = '';
}

// ---------------------------------------------------------------- backup

export function toBackup(state) {
  return JSON.stringify({ app: 'drop-time', exportedAt: new Date().toISOString(), ...state }, null, 1);
}

export function fromBackup(text) {
  const raw = JSON.parse(text);
  if (!raw || raw.app !== 'drop-time' || typeof raw.records !== 'object') {
    throw new Error('This file is not a Drop Time backup.');
  }
  delete raw.app;
  delete raw.exportedAt;
  return normalize(raw);
}
