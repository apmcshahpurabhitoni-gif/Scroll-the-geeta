// Optional reading reminder.
//
// Honest scope: this schedules a local timer while the app is OPEN in this
// tab. Delivering notifications while the site is fully closed requires Web
// Push with a server-side scheduler, which this static build does not have —
// so we never claim otherwise. Permission is requested only after an explicit
// click, never on page load, and there is always a one-click disable.
import { store, todayKey } from './store.js';

let timer = null;

export function reminderSupported() {
  return typeof Notification !== 'undefined';
}

export function permissionState() {
  return reminderSupported() ? Notification.permission : 'unsupported';
}

export function scheduleReminder(onFire) {
  cancel();
  const { enabled, time, lastFired } = store.state.reminder;
  if (!enabled || !reminderSupported() || Notification.permission !== 'granted') return;

  const now = new Date();
  const [h, m] = (time || '08:00').split(':').map(Number);
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const today = todayKey();
  const alreadyFiredToday = lastFired === today && next.getDate() !== now.getDate();
  if (alreadyFiredToday) return;

  timer = setTimeout(() => {
    const key = todayKey();
    if (store.state.reminder.lastFired !== key) {
      store.set('reminder.lastFired', key);
      try {
        const n = new Notification('Today’s Wisdom awaits', {
          body: 'A moment with the Gita — your verse for today is ready.',
          icon: '/icon.svg',
          tag: 'stg-daily',
        });
        n.onclick = () => {
          window.focus();
          location.hash = '#/today';
          n.close();
        };
      } catch {
        /* notification construction can fail in some contexts — harmless */
      }
      onFire?.();
    }
    scheduleReminder(onFire); // arm the next day
  }, next - now);
}

export function cancel() {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Explicit user action — permission is only ever requested from here. */
export async function enableReminder(time, onFire) {
  store.set('reminder.time', time);
  store.set('reminder.enabled', true);
  if (!reminderSupported()) return 'unsupported';
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    store.set('reminder.enabled', false);
    return perm;
  }
  scheduleReminder(onFire);
  return 'granted';
}

export function disableReminder() {
  store.set('reminder.enabled', false);
  cancel();
}
