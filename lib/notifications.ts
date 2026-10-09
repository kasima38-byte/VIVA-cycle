// VIVA Cycle — talks to the phone's notification system (local notifications only).
// Works in Expo Go. All VIVA reminders are rebuilt from planReminders() whenever
// her data or switches change, so they can never go stale.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { todayLocal } from './cycleEngine';
import { planReminders, ReminderTrigger } from './reminders';
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

let syncing: Promise<void> = Promise.resolve();

/** Replace all scheduled VIVA reminders with the current plan. Safe to call often. */
export function syncReminders(state: VivaState): Promise<void> {
  syncing = syncing.then(async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const plan = planReminders(state, todayLocal());
      if (plan.length === 0) return;
      const perm = await Notifications.getPermissionsAsync();
      if (!perm.granted) return;
      await ensureChannel();
      for (const r of plan) {
        await Notifications.scheduleNotificationAsync({
          identifier: r.id,
          content: { title: r.title, body: r.body, data: { url: r.url } },
          trigger: toTrigger(r.trigger),
        });
      }
    } catch (e) {
      console.warn('VIVA: could not schedule reminders', e);
    }
  });
  return syncing;
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
