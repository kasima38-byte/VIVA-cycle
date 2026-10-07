// Mood - Prompt 5 tests, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/moodTracking.test.cjs
const path = require('path');
const memory = new Map();
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => { memory.set(k, v); },
  removeItem: async (k) => { memory.delete(k); },
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
    period: require('../lib/periodService'),
    flow: require('../lib/flowService'),
    sym: require('../lib/symptomService'),
    mood: require('../lib/moodTracking'),
    model: require('../lib/dailyTracking'),
    dates: require('../constants/dateUtils'),
  };
}

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  const base = freshApp();
  const today = base.dates.getToday();
  const D = (n) => base.dates.addDays(today, n);
  const yesterday = D(-1), P = D(-5), P2 = D(-6), OLD = D(-20);

  // Saved data that still uses the earlier ID "veryLow"
  memory.set('viva-cycle:data', JSON.stringify({
    version: 2, setupComplete: true, name: 'Test', dateOfBirth: null,
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null, periods: [],
    dailyLogs: { [OLD]: { date: OLD, mood: 'veryLow' } }, reminders: {},
  }));

  let app = freshApp();
  await app.store.loadVivaStore();
  let { svc, period, flow, sym, model } = app;
  const rec = (d) => svc.readDailyRecord(d);
  const card = (d) => model.fieldSummary(rec(d), 'mood');

  console.log('EARLIER ID');
  check('"veryLow" is read as "very_low" and shown as "Very low"', rec(OLD).mood === 'very_low' && card(OLD) === 'Very low', rec(OLD));
  check('labels come from one central list', eq(model.MOOD_OPTIONS.map((o) => o.value), ['very_low', 'low', 'okay', 'good', 'great']));

  console.log('TEST 1 - new day starts untracked');
  check('Mood = Not tracked (no default)', rec(today).mood === null && card(today) === 'Not tracked', rec(today));

  console.log('TEST 2 / 3 / 12 - Good, then Great (one value only)');
  check('Good saved', (await svc.updateDailyRecord(today, { mood: 'good' })) === 'saved');
  check('card shows "Good"', card(today) === 'Good', card(today));
  check('Great saved', (await svc.updateDailyRecord(today, { mood: 'great' })) === 'saved');
  check('only the latest mood remains', rec(today).mood === 'great' && card(today) === 'Great', rec(today));

  console.log('TEST 4 - leave and return');
  check('Great still saved', app.svc.readDailyRecord(today).mood === 'great');

  console.log('TEST 5 - yesterday: Low');
  check('saved', (await svc.updateDailyRecord(yesterday, { mood: 'low' })) === 'saved');
  check('today = Great, yesterday = Low', rec(today).mood === 'great' && rec(yesterday).mood === 'low');

  console.log('VALIDATION');
  await svc.updateDailyRecord(D(-2), { mood: 'GOOD' });
  await svc.updateDailyRecord(D(-3), { mood: 'good mood' });
  check('inconsistent values are never stored', rec(D(-2)).mood === null && rec(D(-3)).mood === null, [rec(D(-2)), rec(D(-3))]);
  check('future date refused', (await svc.updateDailyRecord(D(1), { mood: 'great' })) === 'future');
  check('no record created for the future date', !app.store.getVivaState().dailyLogs[D(1)]);

  console.log('TEST 8 - period + flow + symptoms + mood coexist');
  await period.markPeriodDay(P);
  await flow.saveFlow(P, 'heavy');
  await sym.saveSymptoms(P, ['cramps']);
  await svc.updateDailyRecord(P, { mood: 'low' });
  check('all four kept', period.getPeriodInfo(P).status === 'period' && rec(P).flow === 'heavy' && eq(rec(P).symptoms, ['cramps']) && rec(P).mood === 'low', rec(P));

  console.log('TEST 9 / 10 / 11 - other changes never touch mood');
  await period.markPeriodDay(P2);
  await period.removePeriodDay(P2);
  check('after changing period: Low', rec(P).mood === 'low');
  await flow.saveFlow(P, 'medium');
  check('after changing flow: Low', rec(P).mood === 'low');
  await sym.saveSymptoms(P, ['cramps', 'headache']);
  check('after changing symptoms: Low', rec(P).mood === 'low');
  await svc.updateDailyRecord(P, { mood: 'okay' });
  check('changing mood keeps period, flow and symptoms', period.getPeriodInfo(P).status === 'period' && rec(P).flow === 'medium' && eq(rec(P).symptoms, ['headache', 'cramps']), rec(P));

  console.log('INSIGHTS DATA');
  const dist = app.mood.moodDistribution(app.store.getVivaState().dailyLogs);
  check('mood distribution', eq(dist, { very_low: 1, low: 1, okay: 1, good: 0, great: 1 }), dist);

  console.log('TEST 6 - restart');
  app = freshApp();
  await app.store.loadVivaStore();
  check('today = Great, yesterday = Low, earlier day = Very low',
    app.svc.readDailyRecord(today).mood === 'great' && app.svc.readDailyRecord(yesterday).mood === 'low' && app.svc.readDailyRecord(OLD).mood === 'very_low');

  console.log('TEST 7 - clear today');
  check('cleared', (await app.svc.updateDailyRecord(today, { mood: null })) === 'saved');
  check('card shows "Not tracked"', app.model.fieldSummary(app.svc.readDailyRecord(today), 'mood') === 'Not tracked');
  check('nothing put in its place', app.svc.readDailyRecord(today).mood === null);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
