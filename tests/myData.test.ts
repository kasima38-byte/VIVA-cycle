// My Data: Profile route, summary from real stored records, export content, cancel and failures.
// REAL store / Calendar service / settings, in-memory AsyncStorage, fake file+share.
// Run: npx -y tsx tests/myData.test.ts
const req: any = require; // Node's require
const fs = req('fs');
const path = req('path');
const ROOT = path.resolve(req.resolve('../package.json'), '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8') as string;

const mem = new Map<string, string>();
const storage = {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => { mem.set(k, v); },
  removeItem: async (k: string) => { mem.delete(k); },
  getAllKeys: async () => [...mem.keys()],
};
const asPath = req.resolve('@react-native-async-storage/async-storage');
req.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: storage } };

const warnings: string[] = [];
const realWarn = console.warn;
console.warn = (...a: unknown[]) => { warnings.push(a.map(String).join(' ')); };

async function boot() {
  Object.keys(req.cache)
    .filter((k) => !k.includes('node_modules') && (k.includes('/lib/') || k.includes('/constants/')))
    .forEach((k) => delete req.cache[k]);
  const app = {
    store: req('../lib/vivaStore'),
    period: req('../lib/periodService'),
    settings: req('../lib/dailyTrackingSettingsService'),
    my: req('../lib/myData'),
    flow: req('../lib/exportFlow'),
    engine: req('../lib/cycleEngine'),
  };
  await app.store.loadVivaStore();
  await app.settings.loadTrackingSettings();
  return app;
}
const settle = () => new Promise((r) => setTimeout(r, 30));
const BLEEDING = ['2025-07-01', '2025-07-02', '2025-07-03', '2025-08-01', '2025-08-02', '2025-08-03', '2025-08-04'];

/** Two confirmed periods (7 bleeding days), tracking on 3 other days incl. private answers,
 *  plus a damaged-copy key, then a restart. "Today" is much later, so the engine predicts many
 *  periods since August 2025 that she never recorded. */
async function seed() {
  mem.clear();
  warnings.length = 0;
  let app = await boot();
  app.store.completeSetup({ name: 'Amina', dateOfBirth: '1995-04-02', lastPeriodStart: '2025-07-01',
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: 'avoid' });
  await settle();
  for (const d of BLEEDING.slice(1)) await app.period.togglePeriodDay(d);
  await app.store.saveDailyLog('2025-07-02', { mood: 'low' });
  await app.store.saveDailyLog('2025-07-15', { symptoms: ['cramps'], energy: 40 });
  await app.store.saveDailyLog('2025-07-20', { sexualActivity: { status: 'activity', entries: [{ protection: 'not_used' }] } });
  await app.store.saveDailyLog('2025-07-22', { medications: [{ id: 'painkiller', name: 'Painkiller' }] });
  await app.settings.updateSetting('moodEnabled', false);
  app.store.setReminder('period', true);
  mem.set('viva-cycle:damaged:2025-05', 'DAMAGED-MARKER unreadable');
  await settle();
  app = await boot();
  return app;
}

/** Fake phone file + share sheet that records what happened. */
function fakeIO(opts: Partial<{ canShare: boolean | 'throw'; writeThrows: boolean; shareThrows: boolean; removeAfterShare: boolean }> = {}) {
  const log = { asked: 0, written: [] as { name: string; text: string }[], shared: [] as string[], removed: [] as string[] };
  const io = {
    canShare: async () => { if (opts.canShare === 'throw') throw new Error('x'); return opts.canShare ?? true; },
    writeFile: (name: string, text: string) => { if (opts.writeThrows) throw new Error('disk'); log.written.push({ name, text }); return 'file:///cache/viva-export/' + name; },
    share: async (uri: string) => { if (opts.shareThrows) throw new Error('share'); log.shared.push(uri); },
    remove: (uri: string) => { log.removed.push(uri); },
    removeAfterShare: opts.removeAfterShare ?? false,
  };
  return { io, log };
}
function deps(app: any, answer: boolean, io: any, log?: any) {
  return {
    getState: app.store.getVivaState,
    getSettings: app.settings.getSettings,
    now: () => new Date(2026, 9, 9, 13, 0),
    ask: async () => { if (log) log.asked++; return answer; },
    io,
  };
}
const snapshot = () => JSON.stringify([...mem.entries()].sort());

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
  // ---------- 1. Profile row ----------
  await check('M1. The Profile My Data row routes to /my-data, and that screen exists', () => {
    const profile = read('app/(tabs)/profile.tsx');
    const row = profile.split('\n').find((l) => l.includes("title: 'My Data'")) ?? '';
    ok(/route: '\/my-data'/.test(row), 'row: ' + row.trim());
    ok(/icon: 'bar-chart'/.test(row) && /subtitle: 'View, export and manage your data'/.test(row), 'row design unchanged');
    ok(/export default function MyDataScreen/.test(read('app/my-data.tsx')), 'screen');
  });

  // ---------- 2. Summary from stored records ----------
  await check('M2. Summary values come from what is actually saved', async () => {
    const app = await seed();
    const s = app.my.getMyDataSummary(app.store.getVivaState());
    eq([s.periodsRecorded, s.latestPeriodStart, s.bleedingDays], [2, '2025-08-01', 7], 'menstrual');
    eq([s.usualCycleLength, s.usualPeriodLength, s.regularity, s.goal], [28, 5, 'regular', 'avoid'], 'settings');
    eq([s.trackingDays, s.latestTrackingDate], [4, '2025-07-22'], 'daily tracking');
    eq(app.store.getVivaState().periods.length, s.periodsRecorded, 'same list Profile and Insights use');
  });

  // ---------- 3. Predictions excluded ----------
  await check('M3. Predictions are never counted as confirmed periods or bleeding days', async () => {
    const app = await seed();
    const st = app.store.getVivaState();
    const est = app.engine.calculateCycle(st.baseline, st.periods, '2026-10-09');
    ok(est && est.estimatedNextPeriod > '2025-08-04' && est.estimatedNextPeriod < '2026-10-09',
      'precondition: the engine predicts a period after her last one, now in the past: ' + (est && est.estimatedNextPeriod));
    const s = app.my.getMyDataSummary(st);
    eq([s.periodsRecorded, s.bleedingDays, s.latestPeriodStart], [2, 7, '2025-08-01'], 'only recorded data');
    const exp = app.my.buildExport(st, app.settings.getSettings(), new Date());
    ok(!JSON.stringify(exp).includes(est.estimatedNextPeriod), 'no predicted date in the export');
    ok(!st.dailyLogs[est.estimatedNextPeriod], 'the predicted day is not a stored record');
  });

  // ---------- 4. Daily tracking counts match storage ----------
  await check('M4. Daily Tracking counts match the records on the phone (after a restart)', async () => {
    const app = await seed();
    const stored: Record<string, any> = {};
    for (const [k, v] of mem) if (k.startsWith('viva-cycle:daily:') && k !== 'viva-cycle:daily-tracking-settings') Object.assign(stored, JSON.parse(v));
    const fields = ['flow', 'symptoms', 'mood', 'energy', 'cervicalMucus', 'sexualActivity', 'medications'];
    const withEntries = Object.values(stored).filter((r: any) => fields.some((f) => r[f] !== null && r[f] !== undefined)).length;
    const bleeding = Object.values(stored).filter((r: any) => r.period === 'yes').length;
    const s = app.my.getMyDataSummary(app.store.getVivaState());
    eq([s.trackingDays, s.bleedingDays], [withEntries, bleeding], 'summary vs stored');
  });

  await check('M4b. A Calendar edit shows up in My Data straight away', async () => {
    const app = await seed();
    await app.period.togglePeriodDay('2025-08-05');
    eq(app.my.getMyDataSummary(app.store.getVivaState()).bleedingDays, 8, 'after adding a day');
    await app.period.togglePeriodDay('2025-08-05');
    eq(app.my.getMyDataSummary(app.store.getVivaState()).bleedingDays, 7, 'after removing it');
    const screen = read('app/my-data.tsx');
    ok(/const state = useVivaStore\(\);/.test(screen) && /getMyDataSummary\(state\)/.test(screen), 'screen reads the live store');
  });

  // ---------- 5. Export content ----------
  await check('M5. Export holds her records and choices, and no storage internals', async () => {
    const app = await seed();
    const { io, log } = fakeIO();
    eq((await app.flow.runExportFlow(deps(app, true, io))).kind, 'offered', 'outcome');
    eq(log.written.length, 1, 'one file');
    eq(log.written[0].name, 'viva-cycle-export-2026-10-09.json', 'file name');
    const text = log.written[0].text;
    const x = JSON.parse(text);
    eq([x.format, x.formatVersion, x.app], ['viva-cycle-export', 1, 'VIVA Cycle'], 'header');
    eq(x.profile, { name: 'Amina', dateOfBirth: '1995-04-02' }, 'profile');
    eq(x.cycleSettings, { usualCycleLength: 28, usualPeriodLength: 5, regularity: 'regular', goal: 'avoid' }, 'settings');
    eq(x.periods.list, app.store.getVivaState().periods, 'periods = canonical list');
    eq(x.dailyTracking.days.length, Object.keys(app.store.getVivaState().dailyLogs).length, 'every saved day');
    eq(x.dailyTracking.days.filter((d: any) => d.period === 'yes').map((d: any) => d.date), BLEEDING, 'bleeding days');
    ok(x.dailyTracking.days.some((d: any) => d.sexualActivity), 'sexual activity record included (and described first)');
    eq([x.settings.reminders, x.settings.discreetNotifications, x.settings.dailyTrackingCategoriesShown.moodEnabled],
      [{ period: true }, true, false], 'settings');
    for (const bad of ['viva-cycle:', 'schemaVersion', '"layout"', 'dailyMonths', 'journal', 'DAMAGED-MARKER', 'backup',
      '"loaded"', 'loadError', 'setupComplete', '"version"']) ok(!text.includes(bad), 'internal artifact in export: ' + bad);
    eq(warnings.filter((w) => /Amina|cramps|not_used|Painkiller/.test(w)), [], 'nothing personal logged');
  });

  await check('M5b. Before sharing, she is told what the file holds (counts only)', async () => {
    const app = await seed();
    const d = app.my.describeExport(app.my.exportContents(app.store.getVivaState()));
    ok(/2 periods \(7 bleeding days\)/.test(d.body), d.body);
    ok(/Daily Tracking on 4 days, including sexual activity on 1 day and medications on 1 day/.test(d.body), d.body);
    ok(/sensitive reproductive-health information/.test(d.body) && /Anyone who gets the file can read it/.test(d.body), 'warning');
    ok(/doesn't send it anywhere/.test(d.body) && /or cancel/.test(d.body), 'where it goes');
    ok(!/Painkiller|cramps|not_used|low/.test(d.body), 'no details in the explanation');
  });

  // ---------- 6. Cancel changes nothing ----------
  await check('M6. Cancelling creates no file and changes no records', async () => {
    const app = await seed();
    const before = snapshot();
    const stateBefore = JSON.stringify(app.store.getVivaState());
    const { io, log } = fakeIO();
    eq((await app.flow.runExportFlow(deps(app, false, io, log))).kind, 'cancelled', 'outcome');
    eq([log.asked, log.written.length, log.shared.length], [1, 0, 0], 'asked / written / shared');
    eq(snapshot(), before, 'storage');
    eq(JSON.stringify(app.store.getVivaState()), stateBefore, 'records in memory');
    eq(app.flow.exportMessage({ kind: 'cancelled' }), null, 'no message');
  });

  await check('M6b. A completed export does not change or delete anything either', async () => {
    const app = await seed();
    const before = snapshot();
    const { io } = fakeIO();
    await app.flow.runExportFlow(deps(app, true, io));
    eq(snapshot(), before, 'storage');
  });

  // ---------- 7. Failures ----------
  await check('M7. Failures are reported honestly and never as success', async () => {
    const app = await seed();
    const cases: [any, string, (l: any) => void][] = [
      [{ canShare: false }, 'unavailable', (l) => eq(l.written.length, 0, 'no file when sharing is unavailable')],
      [{ canShare: 'throw' }, 'unavailable', (l) => eq(l.written.length, 0, 'no file')],
      [{ writeThrows: true }, 'write', (l) => eq(l.shared.length, 0, 'nothing shared')],
      [{ shareThrows: true }, 'share', (l) => eq(l.removed.length, 1, 'file removed when sharing did not open')],
    ];
    for (const [opts, reason, extra] of cases) {
      const { io, log } = fakeIO(opts);
      const out = await app.flow.runExportFlow(deps(app, true, io));
      eq(out, { kind: 'failed', reason }, 'outcome ' + reason);
      extra(log);
      const m = app.flow.exportMessage(out);
      ok(m.kind === 'error' && /nothing was exported/.test(m.text), m.text);
    }
    eq(warnings.filter((w) => /Amina|cramps|not_used|Painkiller|\{/.test(w)), [], 'logs carry no export data');
  });

  await check('M7b. "Offered" never claims the file was saved or sent', async () => {
    const { flow } = await boot();
    const m = flow.exportMessage({ kind: 'offered' });
    ok(m.kind === 'info' && !/(was|were|been) (saved|shared|sent|exported)|success/i.test(m.text), m.text);
  });

  await check('M7c. Data not loaded: nothing exported', async () => {
    const app = await seed();
    const { io, log } = fakeIO();
    const out = await app.flow.runExportFlow({ ...deps(app, true, io, log), getState: () => ({ ...app.store.getVivaState(), loadError: true }) });
    eq([out, log.asked, log.written.length], [{ kind: 'failed', reason: 'notReady' }, 0, 0], 'outcome');
  });

  await check('M7d. Temporary file: removed after sharing on iOS, kept until the next export on Android', async () => {
    const app = await seed();
    const ios = fakeIO({ removeAfterShare: true });
    await app.flow.runExportFlow(deps(app, true, ios.io));
    eq(ios.log.removed.length, 1, 'iOS removes');
    const android = fakeIO({ removeAfterShare: false });
    await app.flow.runExportFlow(deps(app, true, android.io));
    eq(android.log.removed.length, 0, 'Android keeps');
    const io = read('lib/exportIO.ts');
    ok(/if \(dir\.exists\) dir\.delete\(\); \/\/ remove any earlier export/.test(io), 'old exports removed before each new one');
    ok(/Paths\.cache/.test(io), 'cache folder');
  });

  // ---------- 8. Privacy & Security link ----------
  await check('M8. My Data links to Privacy & Security and never deletes by itself', () => {
    const screen = read('app/my-data.tsx');
    ok(/title="Privacy & Security"[\s\S]{0,200}onPress=\{\(\) => router\.push\('\/privacy-security'\)\}/.test(screen), 'link');
    ok(fs.existsSync(path.join(ROOT, 'app/privacy-security.tsx')), 'target screen exists');
    ok(!/deleteAllUserData|deleteAllStoredData|clearTrackingData|removeItem|useEffect/.test(screen), 'no deletion / nothing on open');
  });

  // ---------- Supporting checks ----------
  await check('M9. Libraries are the SDK-matched Expo versions; no network code in export', () => {
    const pkg = JSON.parse(read('package.json')).dependencies;
    const bundled = req('expo/bundledNativeModules.json');
    eq([pkg['expo-sharing'], pkg['expo-file-system']], [bundled['expo-sharing'], bundled['expo-file-system']], 'versions');
    for (const f of ['lib/exportIO.ts', 'lib/exportFlow.ts', 'lib/myData.ts', 'app/my-data.tsx']) {
      ok(!/fetch\(|XMLHttpRequest|uploadAsync|UploadTask|createUploadTask/.test(read(f)), 'network code in ' + f);
    }
  });

  await check('M10. Goal and regularity labels match the Cycle Settings screen', async () => {
    const { my } = await boot();
    const cs = read('app/cycle-settings.tsx');
    // Goals: one shared list (lib/goals.ts) used by Cycle Settings and My Data
    ok(/import \{ GOAL_OPTIONS, goalLabel \} from '..\/lib\/goals';/.test(cs), 'Cycle Settings uses the shared goal list');
    const { GOAL_OPTIONS } = req('../lib/goals');
    for (const o of GOAL_OPTIONS) eq(my.GOAL_LABELS[o.key], o.label, 'goal ' + o.key);
    for (const [k, v] of Object.entries(my.REGULARITY_LABELS)) ok(cs.includes(`{ key: '${k}', label: '${v}'`), 'regularity ' + k);
  });

  console.warn = realWarn;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
