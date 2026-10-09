// Privacy & Security screen: route, truthful content, and the delete confirmation flow.
// Uses the REAL flow (lib/deleteFlow.ts) and the REAL deletion operation with an in-memory
// AsyncStorage and a fake notification system. Never touches the phone's data.
// Run: npx -y tsx tests/privacySecurity.test.ts
const req: any = require; // Node's require (React Native types lack resolve/cache)
const fs = req('fs');
const path = req('path');
const ROOT = path.resolve(req.resolve('../package.json'), '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8') as string;

// ---------- Fake phone storage + notifications ----------
const mem = new Map<string, string>();
let failRemove: string | null = null;
const storage = {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => { mem.set(k, v); },
  removeItem: async (k: string) => { if (k === failRemove) throw new Error('simulated'); mem.delete(k); },
  getAllKeys: async () => [...mem.keys()],
};
const asPath = req.resolve('@react-native-async-storage/async-storage');
req.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: storage } };
let scheduled: any[] = [];
const notifPath = req.resolve('expo-notifications');
req.cache[notifPath] = { id: notifPath, filename: notifPath, loaded: true, exports: { __esModule: true,
  setNotificationHandler: () => {}, setNotificationChannelAsync: async () => {},
  addNotificationResponseReceivedListener: () => ({ remove() {} }),
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  scheduleNotificationAsync: async (n: any) => { scheduled.push(n); },
  cancelAllScheduledNotificationsAsync: async () => { scheduled = []; },
  dismissAllNotificationsAsync: async () => {},
  getAllScheduledNotificationsAsync: async () => scheduled,
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', MONTHLY: 'monthly' },
  AndroidImportance: { DEFAULT: 3 },
} };
const rnPath = req.resolve('react-native');
req.cache[rnPath] = { id: rnPath, filename: rnPath, loaded: true, exports: { Platform: { OS: 'android' } } };
const realWarn = console.warn;
console.warn = () => {};

async function boot() {
  Object.keys(req.cache)
    .filter((k) => !k.includes('node_modules') && (k.includes('/lib/') || k.includes('/constants/')))
    .forEach((k) => delete req.cache[k]);
  const app = {
    store: req('../lib/vivaStore'),
    del: req('../lib/dataDeletionService'),
    flow: req('../lib/deleteFlow'),
    words: req('../lib/dataDeletion'),
    content: req('../lib/privacyContent'),
    settings: req('../lib/dailyTrackingSettingsService'),
  };
  await app.store.loadVivaStore();
  await app.settings.loadTrackingSettings();
  return app;
}
const settle = () => new Promise((r) => setTimeout(r, 30));

async function seed() {
  mem.clear();
  failRemove = null;
  scheduled = [];
  mem.set('@other-app:token', 'keep');
  const app = await boot();
  app.store.completeSetup({ name: 'Amina', dateOfBirth: '1995-04-02', lastPeriodStart: '2025-07-01',
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: 'avoid' });
  await settle();
  await app.store.saveDailyLog('2025-08-10', { sexualActivity: { status: 'activity', entries: [{ protection: 'not_used' }] } });
  app.store.setReminder('medication', true);
  await settle();
  await app.del; // modules loaded
  return boot(); // restart: backup written
}
const vivaKeys = () => [...mem.keys()].filter((k) => k.startsWith('viva-cycle:'));

/** A scripted user: answers each dialog in turn and records everything shown. */
function user(answers: boolean[], run: () => Promise<any>) {
  const log = { asked: [] as string[], told: [] as { title: string; body: string }[], ran: 0, navigated: 0 };
  const deps = {
    ask: async (d: any) => { log.asked.push(d.title); return answers.shift() ?? false; },
    run: async () => { log.ran++; return run(); },
    tell: (m: any, then?: () => void) => { log.told.push(m); then?.(); }, // she taps OK
    goToSafeScreen: () => { log.navigated++; },
  };
  return { deps, log };
}

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
  // ---------- 1. Profile row opens Privacy & Security ----------
  await check('S1. The Profile row routes to /privacy-security, and that screen exists', () => {
    const profile = read('app/(tabs)/profile.tsx');
    const row = profile.split('\n').find((l) => l.includes("title: 'Privacy & Security'")) ?? '';
    ok(/route: '\/privacy-security'/.test(row), 'row has no /privacy-security route: ' + row.trim());
    ok(/icon: 'lock-closed'/.test(row) && /subtitle: 'Privacy, permissions and account security'/.test(row), 'row icon/subtitle changed');
    ok(/router\.push\(route/.test(profile), 'Profile still navigates rows with router.push');
    ok(fs.existsSync(path.join(ROOT, 'app/privacy-security.tsx')), 'app/privacy-security.tsx missing');
    ok(/export default function PrivacySecurityScreen/.test(read('app/privacy-security.tsx')), 'screen has no default export');
  });

  // ---------- 2. Content matches the real architecture ----------
  await check('S2a. "Your Data" says local AsyncStorage, no account/server, not E2E encrypted, backup policy', async () => {
    const { content } = await boot();
    const text = content.YOUR_DATA.items.map((i: any) => i.title + ' ' + i.body).join(' ');
    ok(/on this phone/.test(text) && /AsyncStorage/.test(text), 'local AsyncStorage');
    ok(/no account or login/.test(text) && /doesn't send your records to a VIVA server/.test(text), 'no account/server');
    ok(/not the same as end-to-end encryption/.test(text) && /doesn't add its own encryption/.test(text), 'encryption honesty');
    ok(/Google backups/.test(text) && /doesn't remove backups made before/.test(text) && /follow your phone settings/.test(text), 'backups');
  });

  await check('S2b. No false claims anywhere on the screen', async () => {
    const { content } = await boot();
    const all = JSON.stringify(content) + read('app/privacy-security.tsx');
    for (const bad of [/\bis encrypted\b/i, /\bfully encrypted\b/i, /never leaves?/i, /100% (private|secure)/i,
      /delete (your )?account/i, /\blog ?out\b/i, /\bsign ?in\b/i, /biometric|face id|fingerprint/i,
      /cloud backup (is|has been) (off|disabled)/i]) {
      ok(!bad.test(all), 'forbidden claim: ' + bad);
    }
  });

  await check('S2c. The claims hold in the code: AsyncStorage only, no network or analytics', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = Object.keys(pkg.dependencies);
    ok(deps.includes('@react-native-async-storage/async-storage'), 'AsyncStorage dependency');
    for (const d of deps) ok(!/firebase|sentry|analytics|amplitude|segment|mixpanel|axios|supabase|crashlytics|bugsnag/i.test(d), 'network/analytics dependency: ' + d);
    const files = ['app', 'app/(tabs)', 'lib', 'constants', 'components'].flatMap((dir) =>
      fs.readdirSync(path.join(ROOT, dir)).filter((f: string) => /\.tsx?$/.test(f)).map((f: string) => dir + '/' + f));
    for (const f of files) ok(!/\bfetch\(|XMLHttpRequest|WebSocket/.test(read(f)), 'network call in ' + f);
  });

  await check('S2d. Permissions listed are exactly the ones the code requests', async () => {
    const { content } = await boot();
    eq(content.PERMISSIONS.items.map((i: any) => i.title), ['Notifications', 'Camera and photos'], 'permission list');
    ok(/requestPermissionsAsync/.test(read('lib/notifications.ts')), 'notifications requested in code');
    const pi = read('app/personal-information.tsx');
    ok(/requestCameraPermissionsAsync/.test(pi) && /requestMediaLibraryPermissionsAsync/.test(pi), 'camera/photos requested in code');
    const files = ['app', 'app/(tabs)', 'lib', 'components'].flatMap((dir) =>
      fs.readdirSync(path.join(ROOT, dir)).filter((f: string) => /\.tsx?$/.test(f)).map((f: string) => dir + '/' + f));
    const requesters = files.filter((f: string) => /request\w*Permissions?Async/.test(read(f))).sort();
    eq(requesters, ['app/personal-information.tsx', 'lib/notifications.ts'], 'files that request permissions');
    ok(/when you turn on a reminder/.test(content.PERMISSIONS.items[0].body), 'notification timing');
    ok(/only when you take or choose a profile photo/.test(content.PERMISSIONS.items[1].body), 'camera timing');
  });

  // ---------- 3. Opening the screen does not delete ----------
  await check('S3. Opening the screen deletes nothing (no effect, delete only from a button press)', () => {
    const screen = read('app/privacy-security.tsx');
    ok(!/useEffect|useFocusEffect|useLayoutEffect/.test(screen), 'screen must not run code on open');
    ok(!/deleteAllUserData|deleteAllStoredData|clearTrackingData|removeItem/.test(screen), 'screen must not delete directly');
    eq((screen.match(/requestDeleteAll\(/g) ?? []).length, 1, 'requestDeleteAll called in one place');
    ok(/onPress=\{\(\) => void requestDeleteAll\(\)\}/.test(screen), 'only from onPress');
    const hook = read('lib/useDeleteAllData.ts');
    ok(!/useEffect/.test(hook), 'hook must not run on mount');
  });

  await check('S3b. Visiting the screen leaves stored data intact', async () => {
    const app = await seed();
    const before = vivaKeys().sort();
    ok(before.includes('viva-cycle:data'), 'precondition');
    // Everything the screen loads on open: its content and the hook's flow (without pressing)
    req('../lib/privacyContent');
    req('../lib/deleteFlow');
    await settle();
    eq(vivaKeys().sort(), before, 'keys after opening');
    eq(app.store.getVivaState().name, 'Amina', 'data still shown');
  });

  // ---------- 4. Explicit confirmation ----------
  await check('S4a. Cancel at the first dialog: nothing runs', async () => {
    const { flow } = await boot();
    const u = user([false], async () => { throw new Error('must not run'); });
    eq((await flow.runDeleteFlow(u.deps)).kind, 'cancelled', 'outcome');
    eq([u.log.ran, u.log.asked.length, u.log.told.length, u.log.navigated], [0, 1, 0, 0], 'ran/asked/told/nav');
  });

  await check('S4b. Continue, then Cancel at "Are you sure?": nothing runs', async () => {
    const { flow } = await boot();
    const u = user([true, false], async () => { throw new Error('must not run'); });
    eq((await flow.runDeleteFlow(u.deps)).kind, 'cancelled', 'outcome');
    eq([u.log.ran, u.log.asked], [0, ['Delete all your VIVA Cycle data?', 'Are you sure?']], 'ran/asked');
  });

  await check('S4c. The first dialog explains records, reminders, no undo, outside copies', async () => {
    const { flow } = await boot();
    const b = flow.FIRST_DIALOG.body;
    ok(/personal records and settings VIVA Cycle stores on this phone/.test(b), 'records and settings');
    ok(/scheduled VIVA reminders will be cancelled/.test(b), 'reminders');
    ok(/can't be undone/.test(b), 'no undo');
    ok(/outside the app's control/.test(b) && /not necessarily deleted/.test(b), 'outside copies');
    eq([flow.FIRST_DIALOG.confirm, flow.FINAL_DIALOG.confirm], ['Continue', 'Delete Everything'], 'button labels');
    const hook = read('lib/useDeleteAllData.ts');
    ok(/onDismiss: \(\) => resolve\(false\)/.test(hook), 'closing a dialog counts as Cancel');
  });

  // ---------- 5. Success uses the reusable operation ----------
  await check('S5. Two confirmations run the reusable deletion: data gone, success shown, then Welcome', async () => {
    const app = await seed();
    const u = user([true, true], () => app.del.deleteAllUserData());
    const out = await app.flow.runDeleteFlow(u.deps);
    eq([out.kind, out.result.status, out.result.dataDeleted], ['finished', 'deleted', 'all'], 'outcome');
    eq(vivaKeys(), [], 'VIVA keys left');
    eq(mem.get('@other-app:token'), 'keep', "other app's key");
    eq(scheduled, [], 'reminders');
    eq(u.log.told.map((m) => m.title), ['Your data has been deleted'], 'message');
    eq(u.log.navigated, 1, 'navigated once, after OK');
    const hook = read('lib/useDeleteAllData.ts');
    ok(/return await deleteAllUserData\(\)/.test(hook), 'hook uses deleteAllUserData from lib/dataDeletionService');
  });

  // ---------- 6. Failure never shows success ----------
  await check('S6a. Partial delete: honest error, no success, stays on the screen', async () => {
    const app = await seed();
    failRemove = 'viva-cycle:data-backup';
    const u = user([true, true], () => app.del.deleteAllUserData());
    const out = await app.flow.runDeleteFlow(u.deps);
    eq(out.result.dataDeleted, 'partial', 'dataDeleted');
    eq(u.log.told.map((m) => m.title), ['Not all of your data was deleted'], 'message');
    ok(!/has been deleted/.test(JSON.stringify(u.log.told)), 'no success wording');
    eq(u.log.navigated, 0, 'no navigation');
  });

  await check('S6b. Nothing deleted / unexpected error: honest error, no navigation', async () => {
    const { flow } = await boot();
    for (const run of [
      async () => ({ status: 'failed', dataDeleted: 'nothing', remindersCancelled: true }),
      async () => { throw new Error('boom'); },
    ]) {
      const u = user([true, true], run);
      const out = await flow.runDeleteFlow(u.deps);
      eq([u.log.told.map((m) => m.title), u.log.navigated], [['Nothing was deleted'], 0], 'told/nav');
      eq(out.result.status, 'failed', 'status');
    }
  });

  await check('S6c. The screen shows an inline error only for failed or partial deletes', () => {
    const screen = read('app/privacy-security.tsx');
    ok(/lastOutcome\.result\.dataDeleted !== 'all'/.test(screen), 'inline box limited to failures');
    ok(!/has been deleted|Your data has been deleted/.test(screen), 'no success text hard-coded in the screen');
  });

  // ---------- 7. Safe navigation afterwards ----------
  await check('S7. After a full delete: Welcome via replace, and the tabs redirect there anyway', async () => {
    const hook = read('lib/useDeleteAllData.ts');
    ok(/goToSafeScreen: \(\) => router\.replace\('\/welcome'\)/.test(hook), "router.replace('/welcome')");
    ok(fs.existsSync(path.join(ROOT, 'app/welcome.tsx')), 'Welcome screen exists');
    ok(/if \(!setupComplete\) return <Redirect href="\/welcome" \/>/.test(read('app/(tabs)/_layout.tsx')), 'tabs redirect to Welcome');
    const app = await seed();
    const u = user([true, true], () => app.del.deleteAllUserData());
    await app.flow.runDeleteFlow(u.deps);
    eq(app.store.getVivaState().setupComplete, false, 'setup is reset, so the app starts at Welcome');
    // Data deleted but a reminder could not be confirmed cancelled: still nothing to show, still Welcome
    const v = user([true, true], async () => ({ status: 'failed', dataDeleted: 'all', remindersCancelled: false }));
    await app.flow.runDeleteFlow(v.deps);
    eq([v.log.told[0].title, v.log.navigated], ['Data deleted, but reminders may still appear', 1], 'reminder failure');
  });

  console.warn = realWarn;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
