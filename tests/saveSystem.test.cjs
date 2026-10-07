// Save / edit system - Prompt 10 tests, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/saveSystem.test.cjs
const path = require('path');
const memory = new Map();
let failing = false; // flip on to simulate the phone failing to save
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => { if (failing) throw new Error('simulated storage failure'); memory.set(k, v); },
  removeItem: async (k) => { memory.delete(k); },
};
const asPath = require.resolve('@react-native-async-storage/async-storage');
require.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: fakeStorage } };
const realWarn = console.warn;
console.warn = () => {}; // the store warns on the simulated failure - keep the output clean

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
const stored = () => JSON.parse(memory.get('viva-cycle:data') || '{}').dailyLogs || {};
const strip = (r, ...fields) => { const c = { ...r }; delete c.updatedAt; fields.forEach((f) => delete c[f]); return c; };

async function main() {
  let app = freshApp();
  await app.store.loadVivaStore();
  let { svc, period, flow, sym, mucus, sex, meds, model, dates } = app;
  const today = dates.getToday();
  const D = (n) => dates.addDays(today, n);
  const rec = (d) => svc.readDailyRecord(d);
  const P = D(-5);

  console.log('DATE KEYS (local calendar date, never UTC)');
  check('late evening and just after midnight keep their own local dates',
    dates.dateToKey(new Date(2026, 9, 8, 23, 59)) === '2026-10-08' && dates.dateToKey(new Date(2026, 9, 9, 0, 1)) === '2026-10-09');

  console.log('TEST 1 - basic save survives restart');
  check('Mood = Good saved', (await svc.updateDailyTrackingField(today, 'mood', 'good')) === 'saved');

  console.log('TEST 2 - partial update keeps everything else');
  await period.markPeriodDay(P);
  await flow.saveFlow(P, 'heavy');
  await sym.saveSymptoms(P, ['cramps']);
  await svc.updateDailyRecord(P, { mood: 'good', energy: 70 });
  await mucus.saveMucus(P, 'watery');
  await sex.saveSexualActivity(P, 'activity');
  await meds.addMedication(P, { name: 'Ibuprofen' });
  const before = rec(P);
  check('Mood -> Low', (await svc.updateDailyTrackingField(P, 'mood', 'low')) === 'saved');
  const after = rec(P);
  check('only mood changed', after.mood === 'low' && eq(strip(after, 'mood'), strip(before, 'mood')), { before, after });
  check('updatedAt moved forward', after.updatedAt >= before.updatedAt);
  const stamp = rec(P).updatedAt;
  rec(P); rec(P);
  check('reading never changes updatedAt', rec(P).updatedAt === stamp);
  check('same value again writes nothing', (await svc.updateDailyTrackingField(P, 'mood', 'low')) === 'unchanged' && rec(P).updatedAt === stamp);
  check('unknown value refused', (await svc.updateDailyTrackingField(P, 'mood', 'GOOD')) === 'invalid' && rec(P).mood === 'low');
  check('period cannot be changed as a single field', (await svc.updateDailyTrackingField(P, 'period', 'yes')) === 'invalid');

  console.log('TEST 3 - rapid changes: the latest wins');
  await Promise.all([
    svc.updateDailyTrackingField(D(-1), 'mood', 'good'),
    svc.updateDailyTrackingField(D(-1), 'mood', 'great'),
    svc.updateDailyTrackingField(D(-1), 'mood', 'okay'),
  ]);
  check('on screen: Okay', rec(D(-1)).mood === 'okay');
  check('on the phone: Okay', stored()[D(-1)].mood === 'okay', stored()[D(-1)]);

  console.log('TEST 4 - date isolation');
  await svc.updateDailyTrackingField(D(-8), 'mood', 'good');
  await svc.updateDailyTrackingField(D(-7), 'mood', 'low');
  check('each date keeps its own mood', rec(D(-8)).mood === 'good' && rec(D(-7)).mood === 'low');
  check('one record per date, every key is YYYY-MM-DD', Object.keys(stored()).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)));

  console.log('TEST 6 - clear one field');
  const pBefore = rec(P);
  check('Mood cleared', (await svc.clearDailyRecordField(P, 'mood')) === 'saved');
  check('Mood = Not tracked; every other field unchanged', rec(P).mood === null && eq(strip(rec(P), 'mood'), strip(pBefore, 'mood')));
  check('the day record itself is kept', !!stored()[P]);
  await svc.clearDailyRecordField(D(-8), 'mood');
  check('a day with nothing left is not stored as an empty record', !stored()[D(-8)]);

  console.log('TEST 7 - multi-date period');
  const A = [D(-30), D(-29), D(-28), D(-27)];
  await period.savePeriodRange(A[0], A[3]);
  await svc.updateDailyTrackingField(A[2], 'mood', 'good');
  await svc.updateDailyTrackingField(A[3], 'mood', 'good');
  await flow.saveFlow(A[3], 'light');
  await sym.saveSymptoms(A[3], ['cramps']);
  check('Oct 6-9 style range shortened by one day', (await period.savePeriodRange(A[0], A[2], A[1])) === 'saved');
  const last = rec(A[3]);
  check('the removed day loses only its period answer', last.period === null && last.mood === 'good' && last.flow === 'light' && eq(last.symptoms, ['cramps']), last);
  check('the episode is recalculated (3 days)', period.getPeriodInfo(A[2]).episode.recordedDays === 3);
  check('clearing period through the generic clear keeps the rest', (await svc.clearDailyRecordField(A[2], 'period')) === 'saved' && rec(A[2]).mood === 'good');

  console.log('DATE RANGE QUERY');
  const range = svc.getRecordsForDateRange(A[0], A[3]);
  check('only records inside the range, oldest first', eq(range.map((r) => r.date), [A[0], A[1], A[2], A[3]]), range.map((r) => r.date));

  console.log('TEST 9 - storage failure');
  const phoneBefore = memory.get('viva-cycle:data');
  failing = true;
  check('a failed save reports "failed"', (await svc.updateDailyTrackingField(today, 'mood', 'great')) === 'failed');
  check('nothing unsaved is shown as saved (screen rolled back)', rec(today).mood === 'good', rec(today));
  check('the phone still has the previous data', memory.get('viva-cycle:data') === phoneBefore);
  check('a failed multi-day period change leaves every day as it was', (await period.savePeriodRange(D(-15), D(-13))) === 'failed' && period.getPeriodInfo(D(-14)).status === 'untracked');
  check('a failed sheet save is also rolled back', (await flow.saveFlow(today, 'light')) === 'failed' && rec(today).flow === null);
  failing = false;
  check('Try Again works once storage recovers', (await svc.updateDailyTrackingField(today, 'mood', 'great')) === 'saved' && rec(today).mood === 'great' && stored()[today].mood === 'great');

  console.log('TEST 8 - restart: every record stays with its date');
  const snapshot = JSON.stringify(stored());
  app = freshApp();
  await app.store.loadVivaStore();
  check('all records identical after restart', JSON.stringify(app.store.getVivaState().dailyLogs) === snapshot);
  check('TEST 1 again: today = Great after restart', app.svc.readDailyRecord(today).mood === 'great');
  check('the period day kept its other answers', app.svc.readDailyRecord(P).flow === 'heavy' && app.svc.readDailyRecord(P).medications[0].name === 'Ibuprofen');

  console.warn = realWarn;
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.warn = realWarn; console.error('TEST RUN CRASHED:', e); process.exit(1); });
