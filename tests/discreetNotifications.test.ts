// Discreet Notifications: the REAL store, reminder planner and notification service with an
// in-memory AsyncStorage and a fake notification system. Never touches the phone.
// Run: npx -y tsx tests/discreetNotifications.test.ts
import { plain } from './support/securityFakes'; // phone security modules (Keychain, AES-GCM) for Node
const req: any = require; // Node's require (React Native types lack resolve/cache)
const fs = req('fs');
const path = req('path');
const ROOT = path.resolve(req.resolve('../package.json'), '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8') as string;

// ---------- Fake phone storage ----------
const mem = new Map<string, string>();
let failSet = false;
const storage = {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => { if (failSet) throw new Error('simulated'); mem.set(k, v); },
  removeItem: async (k: string) => { mem.delete(k); },
  getAllKeys: async () => [...mem.keys()],
};
const asPath = req.resolve('@react-native-async-storage/async-storage');
req.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: storage } };

// ---------- Fake notification system (this app's scheduled reminders only) ----------
const N = {
  scheduled: [] as any[],
  granted: true,
  requests: 0,       // permission prompts shown
  failCancel: false,
  stuck: false,      // cancel "works" but one reminder stays scheduled
  failScheduleAt: -1, // the n-th schedule call (0-based, counted per sync) throws
  calls: 0,
};
req.cache[req.resolve('expo-notifications')] = {
  id: 'expo-notifications', filename: 'expo-notifications', loaded: true,
  exports: {
    __esModule: true,
    setNotificationHandler: () => {},
    setNotificationChannelAsync: async () => {},
    addNotificationResponseReceivedListener: () => ({ remove() {} }),
    getPermissionsAsync: async () => ({ granted: N.granted, canAskAgain: true }),
    requestPermissionsAsync: async () => { N.requests++; return { granted: N.granted }; },
    cancelAllScheduledNotificationsAsync: async () => {
      if (N.failCancel) throw new Error('simulated cancel failure');
      N.scheduled = N.stuck ? N.scheduled.slice(0, 1) : [];
      N.calls = 0;
    },
    dismissAllNotificationsAsync: async () => {},
    getAllScheduledNotificationsAsync: async () => N.scheduled,
    scheduleNotificationAsync: async (n: any) => {
      if (N.calls++ === N.failScheduleAt) throw new Error('simulated schedule failure');
      N.scheduled.push(n);
      return n.identifier;
    },
    SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', MONTHLY: 'monthly' },
    AndroidImportance: { DEFAULT: 3 },
  },
};
req.cache[req.resolve('react-native')] = {
  id: 'react-native', filename: 'react-native', loaded: true, exports: { Platform: { OS: 'android' } },
};

const warnings: string[] = [];
const realWarn = console.warn;
console.warn = (...a: unknown[]) => { warnings.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };

async function boot() {
  Object.keys(req.cache)
    .filter((k) => !k.includes('node_modules') && (k.includes('/lib/') || k.includes('/constants/')))
    .forEach((k) => delete req.cache[k]);
  const app = {
    store: req('../lib/vivaStore'),
    notif: req('../lib/notifications'),
    rem: req('../lib/reminders'),
    content: req('../lib/privacyContent'),
    engine: req('../lib/cycleEngine'),
  };
  await app.store.loadVivaStore();
  return app;
}
const settle = () => new Promise((r) => setTimeout(r, 30));
function reset() {
  mem.clear();
  failSet = false;
  Object.assign(N, { scheduled: [], granted: true, requests: 0, failCancel: false, stuck: false, failScheduleAt: -1, calls: 0 });
  warnings.length = 0;
}

/** Set up, with a period 3 days ago (so period, fertility and ovulation reminders are all in
 *  the future), goal "avoid" (pregnancy wording), and the given switches on. */
async function phone(keys: string[]) {
  reset();
  const app = await boot();
  const start = app.engine.addDays(app.engine.todayLocal(), -3);
  app.store.completeSetup({ name: 'Amina', dateOfBirth: null, lastPeriodStart: start,
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: 'avoid' });
  await settle();
  for (const k of keys) app.store.setReminder(k, true);
  await settle();
  return app;
}
const shown = () => N.scheduled.map((n) => ({ id: n.identifier, title: n.content.title, body: n.content.body }));
const triggers = () => Object.fromEntries(N.scheduled.map((n) => [n.identifier, JSON.stringify(n.trigger)]));
const ids = () => N.scheduled.map((n) => n.identifier).sort();
const SENSITIVE = /\d|period|fertil|ovulat|pregnan|contracept|medication|cramp|mood|cycle day|estimated/i;

let pass = 0, fail = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try { await fn(); console.log('PASS  ' + name); pass++; }
  catch (e: any) { console.log('FAIL  ' + name + '\n      ' + (e?.message ?? e)); fail++; }
}
function ok(c: unknown, what: string) { if (!c) throw new Error(what); }
function eq(a: unknown, b: unknown, what: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(what + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}

(async () => {
  let ALL: string[] = [];

  // ---------- 1. On by default ----------
  await check('N1. Discreet Notifications is on for a new installation', async () => {
    reset();
    const app = await boot();
    ALL = app.rem.REMINDER_KEYS;
    eq(app.store.getVivaState().discreetNotifications, true, 'fresh install');
    // Saved before this setting existed: also discreet (the private choice)
    reset();
    mem.set('viva-cycle:data', JSON.stringify({ version: 3, layout: 'monthly', dailyMonths: [], setupComplete: true,
      name: 'Old', dateOfBirth: null, baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' },
      goal: null, periods: [], reminders: { period: true } }));
    const old = await boot();
    eq(old.store.getVivaState().discreetNotifications, true, 'older saved data');
    eq(old.store.getVivaState().reminders, { period: true }, 'older reminder switches kept');
  });

  // ---------- 2. Persists ----------
  await check('N2. The choice is saved and survives a restart', async () => {
    let app = await phone([]);
    eq(await app.store.setDiscreetNotifications(false), true, 'saved');
    app = await boot();
    eq(app.store.getVivaState().discreetNotifications, false, 'off after restart');
    eq(await app.store.setDiscreetNotifications(true), true, 'saved');
    app = await boot();
    eq(app.store.getVivaState().discreetNotifications, true, 'on after restart');
    ok(!mem.has('viva-cycle:daily-tracking-settings') || !/discreet/.test(plain(mem.get('viva-cycle:daily-tracking-settings'), 'viva-cycle:daily-tracking-settings')!),
      'stored with the reminder switches, not the tracking-card settings');
  });

  await check('N2b. A failed save is not shown as saved', async () => {
    const app = await phone([]);
    failSet = true;
    eq(await app.store.setDiscreetNotifications(false), false, 'reports failure');
    eq(app.store.getVivaState().discreetNotifications, true, 'screen goes back to what is saved');
    eq(app.content.discreetNotice(false, null).kind, 'error', 'error shown');
  });

  // ---------- 3. Every category neutral ----------
  await check('N3. With it on, EVERY reminder category shows only neutral text', async () => {
    const app = await phone(ALL);
    const r = await app.notif.syncReminders(app.store.getVivaState());
    eq(r.status, 'ok', 'sync');
    const keysScheduled = new Set(N.scheduled.map((n) => n.identifier.replace(/-.*$/, '')));
    for (const k of ['period', 'fertile', 'ovulation', 'summary', 'medication', 'water', 'activity', 'selfcare', 'tip']) {
      ok(keysScheduled.has(k), 'category not scheduled in this test: ' + k);
    }
    for (const s of shown()) {
      eq([s.title, s.body], ['VIVA Cycle', 'You have a reminder. Open the app to view details.'], s.id);
      ok(!SENSITIVE.test(s.title + ' ' + s.body), 'sensitive text in ' + s.id);
    }
  });

  // ---------- 4. Changing it updates reminders already scheduled ----------
  await check('N4. Turning it on replaces detailed reminders that were already scheduled', async () => {
    const app = await phone(ALL);
    await app.store.setDiscreetNotifications(false);
    await app.notif.syncReminders(app.store.getVivaState());
    ok(shown().some((s) => /fertile window/i.test(s.title)), 'precondition: detailed fertility reminder scheduled');
    ok(shown().some((s) => /Pregnancy may be possible/.test(s.body)), 'precondition: pregnancy wording scheduled');
    const before = ids();
    await app.store.setDiscreetNotifications(true);
    eq((await app.notif.syncReminders(app.store.getVivaState())).status, 'ok', 'sync');
    eq(ids(), before, 'same reminders');
    ok(shown().every((s) => s.title === 'VIVA Cycle' && !SENSITIVE.test(s.body)), 'no detailed reminder left');
    // The app re-syncs by itself when the setting changes
    ok(/discreetNotifications\]\);/.test(read('app/_layout.tsx')), 'layout re-syncs when the setting changes');
  });

  // ---------- 5. No duplicates ----------
  await check('N5. No duplicates, even after many changes and overlapping syncs', async () => {
    const app = await phone(ALL);
    const expected = app.rem.planReminders(app.store.getVivaState(), app.engine.todayLocal()).length;
    for (const on of [false, true, false, true]) {
      await app.store.setDiscreetNotifications(on);
      void app.notif.syncReminders(app.store.getVivaState()); // not awaited: they overlap
    }
    await app.notif.syncReminders(app.store.getVivaState());
    eq(N.scheduled.length, expected, 'number scheduled');
    eq(new Set(ids()).size, N.scheduled.length, 'unique ids');
  });

  // ---------- 6. Switched-off categories stay off ----------
  await check('N6. Reminders she switched off stay off in both modes', async () => {
    const app = await phone(['period', 'medication']);
    for (const on of [true, false]) {
      await app.store.setDiscreetNotifications(on);
      await app.notif.syncReminders(app.store.getVivaState());
      const kinds = [...new Set(N.scheduled.map((n) => n.identifier.replace(/-.*$/, '')))].sort();
      eq(kinds, ['medication', 'period'], 'categories (discreet ' + on + ')');
    }
    eq(app.store.getVivaState().reminders, { period: true, medication: true }, 'switches untouched');
  });

  // ---------- 7. Same times ----------
  await check('N7. Every reminder keeps its exact schedule when the setting changes', async () => {
    const app = await phone(ALL);
    await app.store.setDiscreetNotifications(false);
    await app.notif.syncReminders(app.store.getVivaState());
    const detailed = triggers();
    await app.store.setDiscreetNotifications(true);
    await app.notif.syncReminders(app.store.getVivaState());
    eq(triggers(), detailed, 'triggers');
    eq(N.scheduled.map((n) => n.content.data.url).length, N.scheduled.length, 'tap targets kept');
  });

  // ---------- 8. Off restores detailed wording ----------
  await check('N8. Turning it off brings back the detailed estimate wording', async () => {
    const app = await phone(['period', 'fertile', 'ovulation']);
    await app.notif.syncReminders(app.store.getVivaState());
    await app.store.setDiscreetNotifications(false);
    await app.notif.syncReminders(app.store.getVivaState());
    const plan = app.rem.planReminders(app.store.getVivaState(), app.engine.todayLocal());
    eq(shown(), plan.map((p: any) => ({ id: p.id, title: p.title, body: p.body })), 'exactly the planned text');
    ok(shown().every((s) => !/will start|guaranteed|safe day/i.test(s.title + s.body)), 'no guarantees');
    ok(shown().some((s) => /may|estimate/i.test(s.title + s.body)), 'worded as estimates');
  });

  // ---------- 9. Failures reported honestly ----------
  await check('N9a. Cancelling fails -> reported, never "updated"', async () => {
    const app = await phone(ALL);
    await app.store.setDiscreetNotifications(false);
    await app.notif.syncReminders(app.store.getVivaState());
    N.failCancel = true;
    await app.store.setDiscreetNotifications(true);
    const r = await app.notif.syncReminders(app.store.getVivaState());
    eq(r.status, 'cancelFailed', 'status');
    const msg = app.content.discreetNotice(true, r);
    ok(msg.kind === 'error' && msg.canRetry && /may still show their old text/.test(msg.text), msg.text);
    N.failCancel = false;
    eq((await app.notif.syncReminders(app.store.getVivaState())).status, 'ok', 'retry works');
    ok(shown().every((s) => s.title === 'VIVA Cycle'), 'neutral after retry');
  });

  await check('N9b. A reminder that will not cancel is caught', async () => {
    const app = await phone(['period']);
    await app.notif.syncReminders(app.store.getVivaState());
    N.stuck = true;
    eq((await app.notif.syncReminders(app.store.getVivaState())).status, 'cancelFailed', 'status');
  });

  await check('N9c. Rescheduling fails part-way -> reported with counts', async () => {
    const app = await phone(ALL);
    N.failScheduleAt = 2;
    const r = await app.notif.syncReminders(app.store.getVivaState());
    eq([r.status, r.scheduled], ['scheduleFailed', 2], 'status/count');
    ok(r.expected > 2, 'expected count');
    const msg = app.content.discreetNotice(true, r);
    ok(msg.kind === 'error' && /couldn't be scheduled again/.test(msg.text), msg.text);
  });

  await check('N9d. Logs never contain reminder text', async () => {
    ok(warnings.length > 0, 'precondition: failures were logged');
    for (const w of warnings) ok(!/fertile|ovulat|pregnan|You have a reminder|\d{4}-\d{2}/.test(w), 'log: ' + w);
  });

  // ---------- Permission: never asked by this feature ----------
  await check('N10. The setting never asks for notification permission', async () => {
    const app = await phone(ALL);
    N.granted = false;
    await app.store.setDiscreetNotifications(false);
    const r = await app.notif.syncReminders(app.store.getVivaState());
    eq([r.status, N.requests, N.scheduled.length], ['noPermission', 0, 0], 'status/prompts/scheduled');
    eq(app.content.discreetNotice(true, r).kind, 'info', 'explains notifications are off');
    const screen = read('app/privacy-security.tsx');
    ok(!/ensureReminderPermission|requestPermissionsAsync/.test(screen), 'screen never requests permission');
    eq((read('lib/notifications.ts').match(/requestPermissionsAsync/g) ?? []).length, 1, 'only the reminder switch flow asks');
    ok(!/useEffect|useFocusEffect/.test(screen), 'nothing runs just by opening the screen');
  });

  await check('N11. The screen states the limits honestly', async () => {
    const { content } = await boot();
    const d = content.DISCREET;
    eq([d.title, d.description], ['Discreet Notifications', 'Hide sensitive details in VIVA Cycle notifications.'], 'labels');
    ok(/doesn't hide anything inside the app/.test(d.scope), 'does not claim to protect the unlocked app');
  });

  console.warn = realWarn;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
