// Symptoms - Prompt 4 tests, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/symptomTracking.test.cjs
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
    lib: require('../lib/symptoms'),
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
  let app = freshApp();
  await app.store.loadVivaStore();
  let { svc, period, flow, sym, lib, model } = app;
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const yesterday = D(-1), P = D(-5), P2 = D(-6);
  const rec = (d) => svc.readDailyRecord(d);
  const card = (d) => model.fieldSummary(rec(d), 'symptoms');

  console.log('TEST 1 - today: Cramps');
  check('saved', (await sym.saveSymptoms(today, ['cramps'])) === 'saved');
  check('card shows "1 selected"', card(today) === '1 selected', card(today));

  console.log('TEST 2 - reopen');
  check('Cramps still selected', eq(sym.getSymptoms(today), ['cramps']), sym.getSymptoms(today));

  console.log('TEST 3 - add Bloating + Headache');
  check('saved', (await sym.saveSymptoms(today, ['cramps', 'bloating', 'headache'])) === 'saved');
  check('card shows "3 selected"', card(today) === '3 selected', card(today));
  check('stored as stable IDs in library order', eq(sym.getSymptoms(today), ['headache', 'cramps', 'bloating']), sym.getSymptoms(today));

  console.log('TEST 4 - deselect Bloating');
  check('saved', (await sym.saveSymptoms(today, ['cramps', 'headache'])) === 'saved');
  check('card shows "2 selected"', card(today) === '2 selected', card(today));
  check('replaced, not appended', eq(sym.getSymptoms(today), ['headache', 'cramps']), sym.getSymptoms(today));
  check('same selection again writes nothing', (await sym.saveSymptoms(today, ['headache', 'cramps'])) === 'unchanged');

  console.log('TEST 5 / 6 - yesterday has its own record');
  await sym.saveSymptoms(yesterday, ['nausea']);
  check('yesterday = Nausea', eq(sym.getSymptoms(yesterday), ['nausea']), sym.getSymptoms(yesterday));
  check('today unchanged', eq(sym.getSymptoms(today), ['headache', 'cramps']), sym.getSymptoms(today));

  console.log('TEST 8 - period + flow + symptoms coexist');
  await period.markPeriodDay(P);
  await flow.saveFlow(P, 'heavy');
  await sym.saveSymptoms(P, ['cramps', 'headache']);
  check('all three kept', period.getPeriodInfo(P).status === 'period' && rec(P).flow === 'heavy' && eq(rec(P).symptoms, ['headache', 'cramps']), rec(P));

  console.log('TEST 9 - change period');
  await period.markPeriodDay(P2);
  await period.removePeriodDay(P2);
  check('symptoms unchanged', eq(rec(P).symptoms, ['headache', 'cramps']), rec(P));

  console.log('TEST 10 - change flow');
  await flow.saveFlow(P, 'light');
  check('symptoms unchanged', eq(rec(P).symptoms, ['headache', 'cramps']), rec(P));
  await sym.saveSymptoms(P, ['cramps']);
  check('and changing symptoms keeps flow and period', rec(P).flow === 'light' && period.getPeriodInfo(P).status === 'period', rec(P));

  console.log('PROTECTION - Daily Tracking Save never changes symptoms');
  check('symptom change through Daily Tracking is ignored', (await svc.updateDailyRecord(P, { symptoms: ['acne'] })) === 'unchanged' && eq(rec(P).symptoms, ['cramps']), rec(P));
  await svc.updateDailyRecord(P, { mood: 'okay' });
  check('saving mood keeps symptoms', eq(rec(P).symptoms, ['cramps']) && rec(P).mood === 'okay', rec(P));

  console.log('TEST 12 - no duplicates');
  await sym.saveSymptoms(D(-2), ['cramps', 'cramps', 'bloating']);
  check('["cramps","cramps"] is stored once', eq(sym.getSymptoms(D(-2)), ['cramps', 'bloating']), sym.getSymptoms(D(-2)));
  check('duplicates in saved data are cleaned on read', eq(model.normalizeRecord(D(-3), { symptoms: ['acne', 'acne'] }).symptoms, ['acne']));

  console.log('VALIDATION');
  check('unknown symptom refused', (await sym.saveSymptoms(today, ['madeUp'])) === 'invalid');
  check('future date refused', (await sym.saveSymptoms(D(1), ['cramps'])) === 'future');
  check('no record created for the future date', !app.store.getVivaState().dailyLogs[D(1)]);

  console.log('LIBRARY + PREVIEW');
  check('22 symptoms offered in 5 categories', lib.SYMPTOMS.filter((s) => !s.retired).length === 22 && lib.SYMPTOM_CATEGORIES.length === 5);
  check('preview "Cramps · Bloating · Headache +2"', lib.symptomPreview(['cramps', 'bloating', 'headache', 'acne', 'nausea']) === 'Cramps · Bloating · Headache +2', lib.symptomPreview(['cramps', 'bloating', 'headache', 'acne', 'nausea']));
  check('retired symptom still has its label', lib.symptomLabel('moodSwings') === 'Mood swings');

  console.log('INSIGHTS DATA');
  const freq = sym.getSymptomFrequency();
  check('frequency per symptom', freq.cramps === 3 && freq.headache === 1 && freq.nausea === 1 && freq.bloating === 1, freq);

  console.log('TEST 7 - clear all');
  check('cleared', (await sym.saveSymptoms(today, null)) === 'saved');
  check('card shows "Not tracked"', card(today) === 'Not tracked', card(today));
  await sym.saveSymptoms(yesterday, []);
  check('saving an empty selection = Not tracked (never "no symptoms")', sym.getSymptoms(yesterday) === null && card(yesterday) === 'Not tracked');

  console.log('TEST 11 - restart');
  app = freshApp();
  await app.store.loadVivaStore();
  check('symptoms survived', eq(app.sym.getSymptoms(P), ['cramps']) && eq(app.sym.getSymptoms(D(-2)), ['cramps', 'bloating']));
  check('cleared days stay Not tracked', app.sym.getSymptoms(today) === null);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
