// "Delete all my data" + Clear Daily Tracking Data: the REAL store, settings service, deletion
// service and notification service, with an in-memory AsyncStorage and a fake notification
// system. Never touches the phone's data. Run: npx -y tsx tests/dataDeletion.test.ts
import { plain } from './support/securityFakes'; // phone security modules (Keychain, AES-GCM) for Node
const req: any = require; // Node's require (React Native types lack resolve/cache)
const fs = req('fs');
const path = req('path');

// ---------- Fake phone storage (with switchable failures) ----------
const mem = new Map<string, string>();
const failRemove = new Set<string>(); // keys whose removeItem throws
let failList = false;                  // getAllKeys throws
let failListAfter: number | null = null; // getAllKeys works this many times, then throws
const storage = {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => { mem.set(k, v); },
  removeItem: async (k: string) => {
    if (failRemove.has(k)) throw new Error('simulated remove failure');
    mem.delete(k);
  },
  getAllKeys: async () => {
    if (failList) throw new Error('simulated list failure');
    if (failListAfter !== null) {
      if (failListAfter <= 0) throw new Error('simulated list failure');
      failListAfter--;
    }
    return [...mem.keys()];
  },
};
const asPath = req.resolve('@react-native-async-storage/async-storage');
req.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: storage } };

// ---------- Fake notification system ----------
const notif = {
  scheduled: [] as any[],
  presented: [] as any[],
  failCancel: false,
  stuck: false, // cancel "succeeds" but one reminder stays scheduled
};
const fakeNotifications = {
  setNotificationHandler: () => {},
  setNotificationChannelAsync: async () => {},
  addNotificationResponseReceivedListener: () => ({ remove() {} }),
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: async () => ({ granted: true }),
  scheduleNotificationAsync: async (n: any) => { notif.scheduled.push(n); return n.identifier; },
  cancelAllScheduledNotificationsAsync: async () => {
    if (notif.failCancel) throw new Error('simulated cancel failure');
    notif.scheduled = notif.stuck ? notif.scheduled.slice(0, 1) : [];
  },
  dismissAllNotificationsAsync: async () => { notif.presented = []; },
  getAllScheduledNotificationsAsync: async () => notif.scheduled,
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', MONTHLY: 'monthly' },
  AndroidImportance: { DEFAULT: 3 },
};
const notifPath = req.resolve('expo-notifications');
req.cache[notifPath] = { id: notifPath, filename: notifPath, loaded: true, exports: { __esModule: true, ...fakeNotifications } };
const rnPath = req.resolve('react-native');
req.cache[rnPath] = { id: rnPath, filename: rnPath, loaded: true, exports: { Platform: { OS: 'android' } } };

const realWarn = console.warn;
console.warn = () => {}; // the store warns on simulated failures - keep the output clean

/** Simulate an app (re)start: fresh modules, state loaded from storage. */
async function boot() {
  Object.keys(req.cache)
    .filter((k) => !k.includes('node_modules') && (k.includes('/lib/') || k.includes('/constants/')))
    .forEach((k) => delete req.cache[k]);
  const app = {
    store: req('../lib/vivaStore'),
    del: req('../lib/dataDeletionService'),
    words: req('../lib/dataDeletion'),
    settings: req('../lib/dailyTrackingSettingsService'),
    tracking: req('../lib/dailyTrackingService'),
    profile: req('../constants/profileStore'),
    notifications: req('../lib/notifications'),
  };
  await app.store.loadVivaStore();
  await app.settings.loadTrackingSettings();
  return app;
}
const settle = () => new Promise((r) => setTimeout(r, 30));
const vivaKeys = () => [...mem.keys()].filter((k) => k.startsWith('viva-cycle:')).sort();
const OTHER_KEYS = ['@other-app:session', 'expo-router:state', 'viva-cycle-pregnancy-not-ours']; // not ours

function reset() {
  mem.clear();
  failRemove.clear();
  failList = false;
  failListAfter = null;
  notif.scheduled = [];
  notif.presented = [];
  notif.failCancel = false;
  notif.stuck = false;
}

/** A realistic phone: profile, 3 months of tracking (incl. private answers), a damaged month,
 *  tracking settings, reminders on and scheduled, plus keys that belong to someone else. */
async function seedFullPhone() {
  reset();
  OTHER_KEYS.forEach((k) => mem.set(k, 'keep me'));
  let app = await boot();
  app.store.completeSetup({
    name: 'Amina', dateOfBirth: '1995-04-02', lastPeriodStart: '2025-07-01',
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: 'avoid',
  });
  await settle();
  for (const [date, patch] of [
    ['2025-07-02', { period: 'yes', mood: 'low' }],
    ['2025-08-01', { period: 'yes', symptoms: ['cramps'] }],
    ['2025-08-10', { sexualActivity: { status: 'activity', entries: [{ protection: 'not_used' }] } }],
    ['2025-09-05', { medications: [{ id: 'painkiller', name: 'Painkiller' }], energy: 40 }],
  ] as const) {
    if (!(await app.store.saveDailyLog(date, patch))) throw new Error('seed save failed ' + date);
  }
  if ((await app.settings.updateSetting('moodEnabled', false)) !== 'saved') throw new Error('seed setting failed');
  app.store.setReminder('fertile', true);
  app.store.setReminder('medication', true);
  await settle();
  await app.notifications.syncReminders(app.store.getVivaState());
  notif.presented.push({ title: 'Estimated fertile window starts tomorrow' });
  // A month that was unreadable on an earlier launch, set aside untouched
  mem.set('viva-cycle:damaged:2025-05', '{"2025-05-03":{"sexualActivity":');
  app = await boot(); // restart: writes the backup copy and notices the damaged month
  return app;
}

let pass = 0, fail = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log('PASS  ' + name); pass++; }
  catch (e: any) { console.log('FAIL  ' + name + '\n      ' + (e?.message ?? e)); fail++; }
}
function eq(a: unknown, b: unknown, what: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(what + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function ok(cond: unknown, what: string) {
  if (!cond) throw new Error(what);
}

(async () => {
  await check('D0. The seeded phone really holds every kind of VIVA key', async () => {
    await seedFullPhone();
    const keys = vivaKeys();
    for (const k of ['viva-cycle:data', 'viva-cycle:data-backup', 'viva-cycle:daily:2025-07', 'viva-cycle:daily:2025-08',
      'viva-cycle:daily:2025-09', 'viva-cycle:damaged:2025-05', 'viva-cycle:daily-tracking-settings']) {
      ok(keys.includes(k), 'missing seeded key ' + k);
    }
    ok(notif.scheduled.length > 0, 'reminders should be scheduled before deleting');
  });

  await check('D1. Deletes the primary data and backup keys', async () => {
    const app = await seedFullPhone();
    const r = await app.del.deleteAllUserData();
    eq(r, { status: 'deleted', dataDeleted: 'all', remindersCancelled: true }, 'result');
    ok(!mem.has('viva-cycle:data'), 'viva-cycle:data still on the phone');
    ok(!mem.has('viva-cycle:data-backup'), 'viva-cycle:data-backup still on the phone');
  });

  await check('D2. Deletes every monthly tracking record', async () => {
    const app = await seedFullPhone();
    mem.set('viva-cycle:daily:2024-01', '{"2024-01-04":{"mood":"good"}}'); // orphan month not listed in the profile
    await app.del.deleteAllUserData();
    eq(vivaKeys().filter((k) => k.startsWith('viva-cycle:daily:') && k !== 'viva-cycle:daily-tracking-settings'), [], 'monthly keys left');
  });

  await check('D3. Deletes damaged-month copies (old and newly set aside)', async () => {
    reset();
    let app = await boot();
    app.store.completeSetup({ name: 'B', dateOfBirth: null, lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: null, periodLength: null, regularity: 'not_sure' } });
    await settle();
    // Corrupt a stored month, then restart: the store sets it aside as damaged
    const core = JSON.parse(plain(mem.get('viva-cycle:data'), 'viva-cycle:data')!);
    core.dailyMonths = [...core.dailyMonths, '2025-06'];
    mem.set('viva-cycle:data', JSON.stringify(core));
    mem.set('viva-cycle:daily:2025-06', 'not json {');
    mem.set('viva-cycle:damaged:2024-11', 'also unreadable');
    app = await boot();
    ok(mem.has('viva-cycle:damaged:2025-06'), 'precondition: month set aside');
    eq((await app.del.deleteAllUserData()).status, 'deleted', 'status');
    eq(vivaKeys().filter((k) => k.startsWith('viva-cycle:damaged:')), [], 'damaged keys left');
  });

  await check('D4. Removes a pending journal and the tracking settings', async () => {
    const app = await seedFullPhone();
    mem.set('viva-cycle:journal', JSON.stringify({ sets: [['viva-cycle:data', plain(mem.get('viva-cycle:data'), 'viva-cycle:data')]], removes: [] }));
    await app.del.deleteAllUserData();
    ok(!mem.has('viva-cycle:journal'), 'journal still on the phone');
    ok(!mem.has('viva-cycle:daily-tracking-settings'), 'tracking settings still on the phone');
    eq(vivaKeys(), [], 'every VIVA key gone');
    eq(OTHER_KEYS.map((k) => mem.get(k)), OTHER_KEYS.map(() => 'keep me'), "other apps' keys untouched");
  });

  await check('D5. Cancels scheduled reminders and clears shown ones', async () => {
    const app = await seedFullPhone();
    // A period that started 3 days ago, so fertility reminders really are scheduled
    const d = new Date(Date.now() - 3 * 864e5);
    const recent = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    app.store.logPeriod(recent);
    eq(await app.store.setDiscreetNotifications(false), true, 'show detailed reminders for this check');
    await settle();
    await app.notifications.syncReminders(app.store.getVivaState());
    const titles = notif.scheduled.map((n) => n.content.title + ' ' + n.content.body);
    ok(titles.some((t) => /fertile/i.test(t)), 'precondition: fertile reminder scheduled');
    ok(titles.some((t) => /Pregnancy may be possible/.test(t)), 'precondition: pregnancy-related wording scheduled');
    ok(titles.some((t) => /Medication/.test(t)), 'precondition: medication reminder scheduled');
    const r = await app.del.deleteAllUserData();
    eq(r.remindersCancelled, true, 'remindersCancelled');
    eq(notif.scheduled, [], 'scheduled reminders');
    eq(notif.presented, [], 'reminders still showing');
    eq(app.store.getVivaState().discreetNotifications, true, 'Discreet Notifications back to its default (on)');
    // The app's normal re-sync after deletion schedules nothing (all switches are off)
    await app.notifications.syncReminders(app.store.getVivaState());
    eq(notif.scheduled, [], 'reminders rescheduled after deletion');
  });

  await check('D6a. Journal cannot be removed -> nothing deleted, honest message', async () => {
    const app = await seedFullPhone();
    mem.set('viva-cycle:journal', '{"sets":[],"removes":[]}');
    const before = vivaKeys();
    failRemove.add('viva-cycle:journal');
    const r = await app.del.deleteAllUserData();
    eq(r.status, 'failed', 'status');
    eq(r.dataDeleted, 'nothing', 'dataDeleted');
    eq(vivaKeys(), before, 'no key may be removed when the journal stays');
    eq(app.store.getVivaState().name, 'Amina', 'her data still shown, because it is still saved');
    const msg = app.words.deleteAllResultMessage(r);
    ok(/Nothing was deleted/.test(msg.title) && !/has been deleted|removed/.test(msg.body), 'message: ' + msg.title + ' / ' + msg.body);
    ok(notif.scheduled.length > 0, 'her reminders were put back because her switches are still on');
  });

  await check('D6b. One month cannot be removed -> partial, never reported as deleted', async () => {
    const app = await seedFullPhone();
    failRemove.add('viva-cycle:daily:2025-08');
    const r = await app.del.deleteAllUserData();
    eq(r.status, 'failed', 'status');
    eq(r.dataDeleted, 'partial', 'dataDeleted');
    eq(vivaKeys(), ['viva-cycle:daily:2025-08'], 'only the failing key is left');
    const msg = app.words.deleteAllResultMessage(r);
    eq(msg.title, 'Not all of your data was deleted', 'title');
    // Retry once the phone cooperates
    failRemove.clear();
    eq((await app.del.deleteAllUserData()).status, 'deleted', 'retry');
    eq(vivaKeys(), [], 'all gone after retry');
  });

  await check('D6c. Phone cannot list its keys -> nothing deleted', async () => {
    const app = await seedFullPhone();
    const before = vivaKeys();
    failList = true;
    const r = await app.del.deleteAllUserData();
    eq([r.status, r.dataDeleted], ['failed', 'nothing'], 'result');
    eq(vivaKeys(), before, 'data untouched');
    // Saving still works afterwards
    failList = false;
    eq(await app.store.saveDailyLog('2025-09-20', { mood: 'good' }), true, 'saving after a failed delete');
  });

  await check('D6d. Deleted but cannot re-check the phone -> not reported as deleted', async () => {
    const app = await seedFullPhone();
    failListAfter = 1; // first listing works, the confirmation listing fails
    const r = await app.del.deleteAllUserData();
    eq([r.status, r.dataDeleted], ['failed', 'partial'], 'result');
  });

  await check('D6e. Reminder cancellation fails -> data deleted, but not reported as full success', async () => {
    const app = await seedFullPhone();
    notif.failCancel = true;
    const r = await app.del.deleteAllUserData();
    eq(r, { status: 'failed', dataDeleted: 'all', remindersCancelled: false }, 'result');
    eq(vivaKeys(), [], 'data still deleted');
    const msg = app.words.deleteAllResultMessage(r);
    ok(/reminders may still appear/.test(msg.title), 'message: ' + msg.title);
  });

  await check('D6f. A reminder stays scheduled after cancel -> reported', async () => {
    const app = await seedFullPhone();
    notif.stuck = true;
    const r = await app.del.deleteAllUserData();
    eq([r.status, r.remindersCancelled], ['failed', false], 'result');
  });

  await check('D7. Deleted data is gone from screen at once and cannot reappear after a restart', async () => {
    let app = await seedFullPhone();
    mem.set('viva-cycle:journal', JSON.stringify({ sets: [['viva-cycle:data', plain(mem.get('viva-cycle:data'), 'viva-cycle:data')]], removes: [] }));
    app.profile.updateProfile({ email: 'a@example.com', phone: '+256700000000' });
    eq((await app.del.deleteAllUserData()).status, 'deleted', 'status');
    // In memory, before any restart
    const s = app.store.getVivaState();
    eq([s.setupComplete, s.name, s.dateOfBirth, s.goal, s.periods, s.dailyLogs, s.reminders],
      [false, '', null, null, [], {}, {}], 'store in memory');
    eq(app.settings.getSettings().moodEnabled, true, 'settings back to defaults in memory');
    eq([app.profile.getProfile().email, app.profile.getProfile().phone], ['', ''], 'profile extras in memory');
    eq(app.tracking.getClearSummary().damagedMonths, 0, 'no damaged months remembered');
    // A save attempt right after is allowed and writes only fresh data
    // Restart
    app = await boot();
    const t = app.store.getVivaState();
    eq([t.loadError, t.setupComplete, t.name, t.periods, t.dailyLogs], [false, false, '', [], {}], 'after restart');
    eq(app.settings.getSettings().moodEnabled, true, 'settings after restart');
    eq(vivaKeys(), [], 'no VIVA key recreated by starting the app');
  });

  await check('D8. Clear Daily Tracking Data keeps period days and removes damaged copies', async () => {
    const app = await seedFullPhone();
    const summary = app.tracking.getClearSummary();
    ok(summary.daysAffected > 0 && summary.damagedMonths === 1, 'summary ' + JSON.stringify(summary));
    eq(await app.tracking.clearAllTrackingData(), 'saved', 'result');
    const logs = app.store.getVivaState().dailyLogs;
    eq(Object.keys(logs).sort(), ['2025-07-01', '2025-07-02', '2025-08-01'], 'only period days left');
    eq(Object.values(logs).map((r: any) => [r.period, r.mood, r.symptoms, r.sexualActivity, r.medications]),
      [['yes', null, null, null, null], ['yes', null, null, null, null], ['yes', null, null, null, null]], 'answers removed');
    eq(vivaKeys().filter((k) => k.startsWith('viva-cycle:damaged:')), [], 'damaged copies left');
    ok(!/sexualActivity|medications|cramps/.test(plain(mem.get('viva-cycle:data-backup'), 'viva-cycle:data-backup') ?? ''), 'backup holds no tracking answers');
    ok(mem.has('viva-cycle:data') && mem.has('viva-cycle:daily-tracking-settings'), 'profile and settings kept');
    eq(app.store.getVivaState().periods.map((p: any) => p.start), ['2025-07-01', '2025-08-01'], 'period starts kept');
    eq(await app.tracking.clearAllTrackingData(), 'unchanged', 'nothing left to clear');
    const again = await boot();
    eq(again.store.getVivaState().periods.map((p: any) => p.start), ['2025-07-01', '2025-08-01'], 'period starts after restart');
  });

  await check('D8b. Clear reports failure if a damaged copy cannot be removed, and can be retried', async () => {
    const app = await seedFullPhone();
    failRemove.add('viva-cycle:damaged:2025-05');
    eq(await app.tracking.clearAllTrackingData(), 'failed', 'first attempt');
    eq(app.tracking.getClearSummary().damagedMonths, 1, 'still offered for clearing');
    failRemove.clear();
    eq(await app.tracking.clearAllTrackingData(), 'saved', 'retry');
    eq(app.tracking.getClearSummary().damagedMonths, 0, 'nothing left');
  });

  await check('D9. Wording: deliberate, honest, no cloud claims', async () => {
    const { words } = await boot();
    const all = [words.DELETE_ALL_CONFIRM.body, words.DELETE_ALL_FINAL.body].join(' ');
    ok(/can't be undone/.test(words.DELETE_ALL_CONFIRM.body), 'says it cannot be undone');
    ok(/reminders will be cancelled/.test(words.DELETE_ALL_CONFIRM.body), 'says reminders are cancelled');
    ok(/records and settings VIVA Cycle stores on this phone/.test(words.DELETE_ALL_CONFIRM.body), 'says what is removed');
    ok(/outside the app's control/.test(all) && /not necessarily deleted/.test(all), 'says outside copies are not necessarily removed');
    ok(!/encrypt/i.test(all), 'no encryption claims');
  });

  await check('D10. Deletion only runs after two confirmations, never from navigation', async () => {
    const root = path.resolve(req.resolve('../package.json'), '..');
    const hook = fs.readFileSync(path.join(root, 'lib/useDeleteAllData.ts'), 'utf8');
    eq((hook.match(/deleteAllUserData\(\)/g) ?? []).length, 1, 'deleteAllUserData called from exactly one place');
    ok(/runDeleteFlow\(/.test(hook), 'the hook goes through the two-step flow');
    const flow = fs.readFileSync(path.join(root, 'lib/deleteFlow.ts'), 'utf8');
    ok(flow.indexOf('ask(FIRST_DIALOG)') < flow.indexOf('ask(FINAL_DIALOG)') && flow.indexOf('ask(FINAL_DIALOG)') < flow.indexOf('deps.run()'),
      'run only after both dialogs');
    for (const f of ['app/(tabs)/profile.tsx', 'app/_layout.tsx', 'app/privacy-security.tsx']) {
      ok(!/deleteAllUserData|deleteAllStoredData/.test(fs.readFileSync(path.join(root, f), 'utf8')), f + ' must not delete directly');
    }
  });

  console.warn = realWarn;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
