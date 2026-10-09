// Daily Tracking - Prompt 1 scenarios, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/dailyTracking.test.cjs
// Uses the REAL model, services and store. Only the phone's storage is replaced
// with an in-memory copy, so Test 7 can "restart" by reloading everything from it.

const { plain } = require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const path = require('path');

const memory = new Map();
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => { memory.set(k, v); },
  removeItem: async (k) => { memory.delete(k); }, getAllKeys: async () => [...memory.keys()],
};
const asPath = require.resolve('@react-native-async-storage/async-storage');
require.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: fakeStorage } };

const ROOT = path.join(__dirname, '..');
function freshApp() {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(path.join(ROOT, 'lib')) || k.startsWith(path.join(ROOT, 'constants'))) delete require.cache[k];
  }
  return {
    store: require('../lib/vivaStore'),
    svc: require('../lib/dailyTrackingService'),
    sym: require('../lib/symptomService'),
    model: require('../lib/dailyTracking'),
    dates: require('../constants/dateUtils'),
  };
}

let passed = 0;
let failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
const savedLogs = () => {
  const out = {};
  for (const [k, v] of memory) if (k.startsWith('viva-cycle:daily:')) Object.assign(out, JSON.parse(plain(v, k)));
  return out;
};

async function main() {
  let app = freshApp();
  await app.store.loadVivaStore();
  const { svc, sym, model, dates } = app;
  const today = dates.getToday();
  const yesterday = dates.addDays(today, -1);
  const emptyDay = dates.addDays(today, -10);
  const future = dates.addDays(today, 1);
  console.log('Today is ' + today + ', yesterday is ' + yesterday + '\n');

  console.log('TEST 1 - today: Mood Good, Energy Moderate, save, leave, return');
  check('save today', (await svc.updateDailyRecord(today, { mood: 'good', energy: 50 })) === 'saved');
  let r = await svc.getDailyRecord(today);
  check('values remain', r.mood === 'good' && model.energyLabel(r.energy) === 'Moderate', r);
  check('saving again with no changes writes nothing', (await svc.updateDailyRecord(today, { mood: 'good' })) === 'unchanged');

  console.log('TEST 2 - yesterday: symptoms, save, back to today');
  check('save yesterday', (await sym.saveSymptoms(yesterday, ['headache'])) === 'saved');
  r = await svc.getDailyRecord(today);
  check('today is still separate (no symptoms, mood Good)', r.symptoms === null && r.mood === 'good', r);

  console.log('TEST 3 - back to yesterday');
  r = await svc.getDailyRecord(yesterday);
  check('symptoms still there', same(r.symptoms, ['headache']) && r.mood === null, r);

  console.log('TEST 4 - change yesterday, save');
  check('update yesterday', (await sym.saveSymptoms(yesterday, ['cramps', 'bloating'])) === 'saved');
  r = await svc.getDailyRecord(yesterday);
  check('old value replaced', same(r.symptoms, ['cramps', 'bloating']), r);
  check('still exactly 2 saved days (no duplicate)', Object.keys(savedLogs()).length === 2, Object.keys(savedLogs()));

  console.log('TEST 5 - a date with no record');
  r = await svc.getDailyRecord(emptyDay);
  check('every field is untracked (null)', model.TRACKED_FIELDS.every((f) => r[f] === null), r);
  check('every card says "Not tracked"', model.TRACKED_FIELDS.every((f) => model.fieldSummary(r, f) === 'Not tracked'));
  check('no record was created', !svc.hasDailyRecord(emptyDay));

  console.log('TEST 6 - jump between dates repeatedly');
  let leaks = 0;
  for (let i = 0; i < 30; i++) {
    const t = await svc.getDailyRecord(today);
    const y = await svc.getDailyRecord(yesterday);
    const e = await svc.getDailyRecord(emptyDay);
    if (t.mood !== 'good' || t.symptoms !== null) leaks++;
    if (y.mood !== null || !same(y.symptoms, ['cramps', 'bloating'])) leaks++;
    if (model.TRACKED_FIELDS.some((f) => e[f] !== null)) leaks++;
  }
  check('no data leaked between dates (30 rounds)', leaks === 0, leaks);
  check('future date refused', (await svc.updateDailyRecord(future, { mood: 'great' })) === 'future');
  check('no record created for the future date', !svc.hasDailyRecord(future));

  console.log('TEST 7 - restart the app');
  app = freshApp();
  await app.store.loadVivaStore();
  const t7 = await app.svc.getDailyRecord(today);
  const y7 = await app.svc.getDailyRecord(yesterday);
  check('today survived restart', t7.mood === 'good' && app.model.energyLabel(t7.energy) === 'Moderate', t7);
  check('yesterday survived restart', same(y7.symptoms, ['cramps', 'bloating']), y7);
  check('saved time recorded', typeof t7.updatedAt === 'string', t7.updatedAt);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
