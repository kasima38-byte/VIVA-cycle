// VIVA Cycle — talks to the phone's notification system (local notifications only).
// Works in Expo Go. All VIVA reminders are rebuilt from planReminders() whenever
// her data or switches change, so they can never go stale.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { todayLocal } from './cycleEngine';
import { planReminders, presentReminders, ReminderTrigger } from './reminders';
import type { VivaState } from './vivaStore';

const CHANNEL = 'viva-reminders';

// Show reminders even while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady: Promise<unknown> | null = null;
function ensureChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'VIVA reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return channelReady;
}

/** Ask for permission (only when she turns a reminder on). Returns true if allowed. */
export async function ensureReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function toTrigger(t: ReminderTrigger): Notifications.NotificationTriggerInput {
  const channelId = Platform.OS === 'android' ? CHANNEL : undefined;
  switch (t.kind) {
    case 'date': {
      const [y, m, d] = t.date.split('-').map(Number);
      return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(y, m - 1, d, t.hour, t.minute), channelId };
    }
    case 'daily':
      return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute, channelId };
    case 'monthly':
      return { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: t.day, hour: t.hour, minute: t.minute, channelId };
  }
}

let syncing: Promise<unknown> = Promise.resolve();

export type ReminderSyncResult =
  | { status: 'ok'; scheduled: number }
  /** Reminders are switched on, but the phone doesn't allow VIVA notifications: none scheduled. */
  | { status: 'noPermission' }
  /** Old reminders could not be (confirmed) cancelled, so some may still show their old text. */
  | { status: 'cancelFailed' }
  /** Old reminders were cancelled, but only `scheduled` of `expected` new ones were scheduled. */
  | { status: 'scheduleFailed'; scheduled: number; expected: number };

/** Replace all scheduled VIVA reminders with the current plan. Safe to call often.
 *  The phone can't edit a scheduled notification's text, so every sync cancels ALL of this app's
 *  scheduled reminders, checks none are left, then schedules the plan again with the same ids and
 *  times. Text follows her Discreet Notifications setting. Never asks for permission.
 *  Never throws: the result says exactly what happened. Logs never include reminder text. */
export function syncReminders(state: VivaState): Promise<ReminderSyncResult> {
  const run = syncing.then(() => doSync(state));
  syncing = run;
  return run;
}

async function doSync(state: VivaState): Promise<ReminderSyncResult> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync(); // this app's reminders only
    const left = await Notifications.getAllScheduledNotificationsAsync();
    if (left.length > 0) throw new Error('still scheduled');
  } catch {
    console.warn('VIVA: could not cancel scheduled reminders');
    return { status: 'cancelFailed' };
  }
  const plan = presentReminders(planReminders(state, todayLocal()), state.discreetNotifications !== false);
  if (plan.length === 0) return { status: 'ok', scheduled: 0 };
  let scheduled = 0;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return { status: 'noPermission' };
    await ensureChannel();
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { url: r.url } },
        trigger: toTrigger(r.trigger),
      });
      scheduled++;
    }
  } catch {
    console.warn('VIVA: could not schedule reminders'); // never log the reminder text
    return { status: 'scheduleFailed', scheduled, expected: plan.length };
  }
  return { status: 'ok', scheduled };
}

/** Cancel EVERY scheduled VIVA reminder and remove any already showing in the notification
 *  list, then check that nothing is still scheduled. Waits for any reminder sync under way,
 *  so an older sync can't schedule reminders after this. Throws if any step fails. */
export function cancelAllReminders(): Promise<void> {
  const run = syncing.then(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
    const left = await Notifications.getAllScheduledNotificationsAsync();
    if (left.length > 0) throw new Error(left.length + ' reminder(s) still scheduled');
  });
  syncing = run.catch(() => {}); // a failure here must not block later syncs
  return run;
}

/** Open the right screen when she taps a reminder. Returns an unsubscribe function. */
export function listenForReminderTaps(open: (url: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  });
  return () => sub.remove();
}
