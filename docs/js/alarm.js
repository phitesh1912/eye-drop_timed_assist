// Sound, vibration, screen wake lock and the bridge to the Android app.
//
// In the Android app the phone's own alarm system rings (works even when the
// app is closed), so the page stays quiet and only shows the alarm screen.
// In a browser (iPhone web app) the page plays the alarm sound itself, which only
// works while the app is open on screen. iPhones don't let web pages vibrate at all.

export const native = typeof window !== 'undefined' ? window.DropTimeAndroid || null : null;
export const isAndroidApp = !!native;

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
export const isAndroidBrowser = !isAndroidApp && /Android/.test(ua);
export const isStandalone = typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);

// ---------------------------------------------------------------- native bridge

export function nativeInfo() {
  if (!native) return null;
  try {
    return JSON.parse(native.getInfo());
  } catch {
    return null;
  }
}

let lastSent = '';
export function syncNativeAlarms(plan) {
  if (!native) return;
  const list = plan.map((r) => ({ at: r.at, title: r.title, text: r.text }));
  const json = JSON.stringify(list);
  if (json === lastSent) return;
  lastSent = json;
  try {
    native.setAlarms(json);
  } catch { /* old app version */ }
}

export function nativeCall(method, ...args) {
  if (!native || typeof native[method] !== 'function') return undefined;
  try {
    return native[method](...args);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- web sound

let audio = null;
let unlocked = false;
let ringing = false;
let vibrateTimer = null;
let plays = 0; // counts real plays (alarm or test), so the silent unlock never stops one

// Alarm loudness, 1 (quiet) to 5 (loudest), chosen in Settings. iPhones don't let a web page
// set the volume, so every step is its own sound file (each half as loud as the next).
export const LEVELS = 5;
export const LEVEL_NAMES = ['', 'Very quiet', 'Quiet', 'Medium', 'Loud', 'Loudest'];
let level = LEVELS;

export function clampLevel(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(1, Math.min(LEVELS, v)) : LEVELS;
}

function soundUrl() {
  const base = document.documentElement.dataset.base || '';
  return `${base}assets/alarm-${level}.wav`;
}

export function initSound(startLevel = LEVELS) {
  level = clampLevel(startLevel);
  if (isAndroidApp) {
    nativeCall('setAlarmLevel', level); // the app keeps its own copy for the phone's alarm
    return;
  }
  if (audio) return;
  audio = new Audio(soundUrl());
  audio.loop = true;
  audio.preload = 'auto';
  // iPhone: let the alarm play even when the side switch is on silent.
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* not supported */ }
}

export function soundReady() {
  return isAndroidApp || unlocked;
}

export function alarmLevel() {
  return level;
}

// Use another loudness step from now on (alarms and the test sound).
export function setAlarmLevel(next) {
  level = clampLevel(next);
  if (isAndroidApp) {
    nativeCall('setAlarmLevel', level);
    return;
  }
  if (!audio) return;
  // Same element, new file: an iPhone keeps allowing sound on an element it has already played.
  const wasRinging = ringing;
  audio.src = soundUrl();
  audio.load();
  if (wasRinging) audio.play().catch(() => {});
}

// Browsers only allow sound after someone has touched the page once.
export function unlockSound() {
  if (isAndroidApp || unlocked || !audio) return;
  const before = plays;
  audio.muted = true;
  const p = audio.play();
  const done = () => {
    // Stop the silent unlock play, but not an alarm or test sound that started meanwhile
    // (the same tap that unlocks is often the "Play sound" tap).
    if (!ringing && plays === before) {
      audio.pause();
      audio.currentTime = 0;
    }
    audio.muted = false;
    unlocked = true;
  };
  if (p && p.then) p.then(done).catch(() => { audio.muted = false; });
  else done();
}

export async function startRinging() {
  ringing = true;
  if (isAndroidApp) return true;
  plays++;
  vibrate();
  clearInterval(vibrateTimer);
  vibrateTimer = setInterval(vibrate, 4000);
  if (!audio) return false;
  try {
    audio.muted = false;
    audio.currentTime = 0;
    await audio.play();
    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function stopRinging() {
  ringing = false;
  clearInterval(vibrateTimer);
  vibrateTimer = null;
  try { navigator.vibrate?.(0); } catch { /* ignore */ }
  if (audio) audio.pause();
  nativeCall('stopRinging');
}

function vibrate() {
  try { navigator.vibrate?.([700, 300, 700, 300, 700]); } catch { /* ignore */ }
}

export function testSound() {
  if (isAndroidApp) {
    nativeCall('playTestSound');
    return;
  }
  if (!audio) return;
  plays++;
  const mine = plays;
  audio.muted = false;
  audio.currentTime = 0;
  audio.play().then(() => {
    unlocked = true;
    setTimeout(() => { if (!ringing && plays === mine) audio.pause(); }, 3500);
  }).catch(() => {});
  vibrate();
}

// ---------------------------------------------------------------- keep screen on

let wakeLock = null;
let wantAwake = false;

export function wakeLockSupported() {
  return !isAndroidApp && 'wakeLock' in navigator;
}

export async function setKeepAwake(on) {
  wantAwake = on;
  if (!wakeLockSupported()) return false;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
    return true;
  } catch {
    return false;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wantAwake) setKeepAwake(true);
  });
}

// ---------------------------------------------------------------- web notifications

export function notificationsSupported() {
  return !isAndroidApp && 'Notification' in window && 'serviceWorker' in navigator;
}

export async function askNotifications() {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function webNotify(title, body) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, {
    body,
    tag: 'droptime-alarm',
    renotify: true,
    requireInteraction: true,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    vibrate: [700, 300, 700, 300, 700],
  })).catch(() => {});
}
