// Empty states, validation and data integrity - Prompt 11 tests (no phone needed)
// Run: npx --yes tsx tests/dataIntegrity.test.cjs
const fs = require('fs');
const path = require('path');
const memory = new Map();
let failing = false;
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => { if (failing) throw new Error('simulated storage failure'); memory.set(k, v); },
  removeItem: async (k) => { memory.delete(k); },
};
const asPath = require.resolve('@react-native-async-storage/async-storage');
require.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: fakeStorage } };
const realWarn = console.warn;
console.warn = () => {};

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
    mucus: require('../lib/mucusService'),
    sex: require('../lib/sexualActivityService'),
    meds: require('../lib/medicationService'),
    medlib: require('../lib/medications'),
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
const stored = () => {
  // Daily records live in one key per month ("viva-cycle:daily:YYYY-MM")
  const out = {};
  for (const [k, v] of memory) if (k.startsWith('viva-cycle:daily:')) Object.assign(out, JSON.parse(v));
  for (const d of Object.keys(out)) { const { schemaVersion: _v, ...r } = out[d]; out[d] = r; }
  return out;
};
const canon = (logs) => JSON.stringify(Object.keys(logs).sort().map((d) => [d, logs[d]]));

async function main() {
  let app = freshApp();
  await app.store.loadVivaStore();
  let { svc, period, flow, sym, mucus, sex, meds, medlib, model, dates } = app;
  const today = dates.getToday();
  const D = (n) => dates.addDays(today, n);
  const rec = (d) => svc.readDailyRecord(d);
  const cards = (d) => model.TRACKED_FIELDS.map((f) => model.fieldSummary(rec(d), f));

  console.log('TEST 1 - completely new date');
  const blank = rec(D(-3));
  check('every field is null (no invented values)', model.TRACKED_FIELDS.every((f) => blank[f] === null), blank);
  check('all 8 cards say "Not tracked"', cards(D(-3)).every((c) => c === 'Not tracked'), cards(D(-3)));
  check('state is empty, 0 tracked', model.trackingState(blank) === 'empty' && model.trackedCount(blank) === 0);
  check('reading a date never creates a record', !stored()[D(-3)] && !svc.hasDailyRecord(D(-3)));

  console.log('TEST 2 - partial record is valid');
  check('Mood Good saved', (await svc.updateDailyTrackingField(today, 'mood', 'good')) === 'saved');
  check('Energy High saved', (await svc.updateDailyTrackingField(today, 'energy', 70)) === 'saved');
  check('2 of 8 tracked, state partial, nothing else filled in',
    model.trackedCount(rec(today)) === 2 && model.trackingState(rec(today)) === 'partial' && rec(today).symptoms === null && rec(today).cervicalMucus === null);

  console.log('TEST 3 - clear one field');
  await svc.clearDailyRecordField(today, 'mood');
  check('Mood back to Not tracked, Energy untouched', rec(today).mood === null && model.fieldSummary(rec(today), 'mood') === 'Not tracked' && rec(today).energy === 70);

  console.log('TEST 4 - invalid energy');
  check('150 refused (never clamped into a reading)', (await svc.updateDailyTrackingField(D(-1), 'energy', 150)) === 'invalid' && rec(D(-1)).energy === null);
  check('-5 refused', (await svc.updateDailyTrackingField(D(-1), 'energy', -5)) === 'invalid' && rec(D(-1)).energy === null);
  check('NaN refused', (await svc.updateDailyTrackingField(D(-1), 'energy', NaN)) === 'invalid' && rec(D(-1)).energy === null);
  check('text refused', (await svc.updateDailyTrackingField(D(-1), 'energy', 'high')) === 'invalid');

  console.log('TEST 5 - symptom duplicates');
  await sym.saveSymptoms(D(-2), ['cramps', 'cramps']);
  check('stored once', eq(stored()[D(-2)].symptoms, ['cramps']), stored()[D(-2)]);

  console.log('NOT TRACKED vs RECORDED NONE');
  check('older explicit "No symptoms" ([]) is shown and counted', model.fieldSummary(model.normalizeRecord(D(-9), { symptoms: [] }), 'symptoms') === 'No symptoms' && model.trackedCount(model.normalizeRecord(D(-9), { symptoms: [] })) === 1);
  check('null symptoms are not counted', model.trackedCount(model.normalizeRecord(D(-9), { mood: 'good' })) === 1);
  await sex.saveSexualActivity(D(-4), 'none');
  check('"No activity" is a recorded answer (counted), not "not tracked"', model.trackedCount(rec(D(-4))) === 1 && sex.getSexualActivity(D(-4)).status === 'none');
  await sex.saveSexualActivity(D(-5), 'activity');
  check('protection not recorded stays null - never "not used"', sex.getSexualActivity(D(-5)).entries[0].protection === null);

  console.log('NO CROSS-FIELD ASSUMPTIONS');
  await flow.saveFlow(D(-6), 'spotting');
  check('spotting does not create a period day', period.getPeriodInfo(D(-6)).status === 'untracked');
  await period.markPeriodDay(D(-7));
  check('a period day gets no flow and no mucus', rec(D(-7)).flow === null && rec(D(-7)).cervicalMucus === null);

  console.log('MEDICATIONS');
  check('dose is optional', (await meds.addMedication(D(-8), { name: 'Ibuprofen' })).result === 'saved');
  check('same name, different dose = two real entries', (await meds.addMedication(D(-8), { name: 'Ibuprofen', dose: '200', unit: 'mg' })).result === 'saved' && meds.getMedications(D(-8)).length === 2);
  check('valid doses accepted', ['400', '1.5', '0,5', '1-2', '½', '1½'].every((d) => medlib.isValidDose(d)));
  check('invalid doses refused', ['abc', '400mg', '-', '1..5'].every((d) => !medlib.isValidDose(d)));
  check('service refuses an invalid dose', (await meds.addMedication(D(-8), { name: 'Iron', dose: 'lots' })).result === 'invalidDose' && meds.getMedications(D(-8)).length === 2);

  console.log('DATE INTEGRITY + EMPTY STORAGE');
  check('every stored key is YYYY-MM-DD', Object.keys(stored()).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)));
  await svc.updateDailyTrackingField(D(-10), 'mood', 'okay');
  await svc.clearDailyRecordField(D(-10), 'mood');
  check('a day emptied again is removed, not kept as an empty record', !stored()[D(-10)]);

  console.log('TEST 6 - date switch (data level)');
  await svc.updateDailyTrackingField(D(-11), 'mood', 'good');
  check('the next day does not show it', rec(D(-12)).mood === null);

  console.log('TEST 7 - save failure keeps data recoverable');
  failing = true;
  check('failure reported', (await svc.updateDailyTrackingField(today, 'mood', 'great')) === 'failed');
  check('saved data is not replaced with an empty state', rec(today).energy === 70 && rec(today).mood === null);
  failing = false;
  check('retry succeeds', (await svc.updateDailyTrackingField(today, 'mood', 'great')) === 'saved');

  console.log('CALM, NON-JUDGEMENTAL WORDING');
  const files = ['app/daily-tracking.tsx', 'components/TrackingCard.tsx', 'components/PeriodSheet.tsx', 'components/FlowSheet.tsx',
    'components/SymptomsSheet.tsx', 'components/MucusSheet.tsx', 'components/SexualActivitySheet.tsx', 'components/MedicationsSheet.tsx',
    'components/EnergySlider.tsx', 'components/MoodSelector.tsx'];
  const text = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const nag = text.match(/forgot|you haven't|complete your|you're missing|incomplete|well done|% complete|tracking score|missing \d/i);
  check('no nagging, scoring or judgemental wording', !nag, nag && nag[0]);
  check('neutral progress wording is used', /categories tracked/.test(fs.readFileSync(path.join(ROOT, 'app/daily-tracking.tsx'), 'utf8')));

  console.log('TEST 8 - restart');
  const snapshot = canon(stored());
  app = freshApp();
  await app.store.loadVivaStore();
  check('every partial record survives exactly', canon(app.store.getVivaState().dailyLogs) === snapshot);
  check('today: Great + Energy 70, nothing else', app.svc.readDailyRecord(today).mood === 'great' && app.svc.readDailyRecord(today).energy === 70 && app.model.trackedCount(app.svc.readDailyRecord(today)) === 2);

  console.warn = realWarn;
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.warn = realWarn; console.error('TEST RUN CRASHED:', e); process.exit(1); });
