// Storage architecture - Prompt 12 tests (no phone needed)
// Run: npx --yes tsx tests/storageArchitecture.test.cjs
const { plain } = require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const memory = new Map();
let failAfter = Infinity;
let setCount = 0;
let writes = [];
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => {
    setCount++;
    if (setCount > failAfter) throw new Error('simulated storage failure');
    writes.push(k);
    memory.set(k, v);
  },
  removeItem: async (k) => { writes.push('-' + k); memory.delete(k); }, getAllKeys: async () => [...memory.keys()],
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
    storage: require('../lib/dailyStorage'),
    model: require('../lib/dailyTracking'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function load() { const app = freshApp(); await app.store.loadVivaStore(); await settle(); return app; }

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const DAY = 'viva-cycle:daily:';
const core = () => JSON.parse(plain(memory.get('viva-cycle:data'), 'viva-cycle:data') || '{}');
const bucket = (m) => JSON.parse(plain(memory.get(DAY + m), DAY + m) || '{}');
const snap = () => JSON.stringify([...memory.entries()].sort());

async function main() {
  let app = await load();
  let { svc, period, flow, sym, mucus, sex, meds, dates } = app;
  const today = dates.getToday();
  const D = (n) => dates.addDays(today, n);
  const info = (d) => app.period.getPeriodInfo(d);

  console.log('TEST 1 - save and retrieve exact values');
  const day = D(-2);
  await period.markPeriodDay(D(-20));
  await period.markPeriodDay(day);
  await svc.updateDailyTrackingField(day, 'mood', 'good');
  await svc.updateDailyTrackingField(day, 'energy', 65);
  await flow.saveFlow(day, 'light');
  await sym.saveSymptoms(day, ['cramps', 'headache']);
  await mucus.saveMucus(day, 'other', 'Thicker');
  await sex.saveSexualActivity(day, 'activity', 'used');
  const med = await meds.addMedication(day, { name: 'Ibuprofen', dose: '400', unit: 'mg', time: '10:30' });
  const got = await svc.getDailyRecord(day);
  check('retrieved exactly', got.mood === 'good' && got.energy === 65 && got.flow === 'light' && eq(got.symptoms, ['headache', 'cramps']) && got.cervicalMucus === 'other' && got.cervicalMucusNote === 'Thicker' && got.period === 'yes' && got.medications[0].id === med.id, got);
  const disk = bucket(day.slice(0, 7))[day];
  check('stored as IDs and numbers - never labels', disk.mood === 'good' && disk.energy === 65 && disk.flow === 'light' && eq(disk.symptoms, ['headache', 'cramps']) && disk.cervicalMucus === 'other' && disk.cervicalMucusNote === 'Thicker' && eq(disk.sexualActivity, { status: 'activity', entries: [{ protection: 'used' }] }) && disk.medications[0].id === med.id && disk.medications[0].dose === '400' && disk.medications[0].unit === 'mg' && disk.medications[0].time === '10:30', disk);
  check('every stored record carries schemaVersion 1', disk.schemaVersion === 1);
  check('the profile key holds no daily records and lists the months', !('dailyLogs' in core()) && core().layout === 'monthly' && core().version === 3 && core().dailyMonths.includes(day.slice(0, 7)), core());
  const created = got.createdAt;
  await svc.updateDailyTrackingField(day, 'mood', 'great');
  const later = await svc.getDailyRecord(day);
  check('createdAt kept, updatedAt moved on, date unchanged', typeof created === 'string' && later.createdAt === created && later.updatedAt >= got.updatedAt && later.date === day);

  console.log('TEST 2 - date isolation');
  const a = D(-4), b = D(-3);
  await svc.updateDailyTrackingField(a, 'mood', 'good');
  await svc.updateDailyTrackingField(b, 'mood', 'low');
  const bBefore = JSON.stringify(bucket(b.slice(0, 7))[b]);
  await svc.updateDailyTrackingField(a, 'mood', 'okay');
  check('updating one date leaves the other untouched', JSON.stringify(bucket(b.slice(0, 7))[b]) === bBefore && svc.readDailyRecord(b).mood === 'low');
  const allMatch = [...memory.entries()].filter(([k]) => k.startsWith(DAY)).every(([k, v]) => Object.entries(JSON.parse(plain(v, k))).every(([d, r]) => r.date === d && d.slice(0, 7) === k.slice(DAY.length)));
  check('every stored record sits under its own date, in its own month', allMatch);

  console.log('TEST 3 - month and range queries');
  const anchor = D(-60);
  const [yy, mm] = anchor.slice(0, 7).split('-').map(Number);
  const first = anchor.slice(0, 8) + '01';
  const daysInMonth = new Date(yy, mm, 0).getDate();
  for (let i = 0; i < daysInMonth; i++) await svc.updateDailyTrackingField(dates.addDays(first, i), 'mood', 'okay');
  check('whole month returned (' + daysInMonth + ' days)', svc.getRecordsForMonth(yy, mm).length === daysInMonth);
  const r10 = svc.getRecordsForDateRange(dates.addDays(first, 9), dates.addDays(first, 14));
  check('days 10-15 only', r10.length === 6 && r10[0].date === dates.addDays(first, 9) && r10[5].date === dates.addDays(first, 14));
  check('range across the whole month matches the month query', eq(svc.getRecordsForDateRange(first, dates.addDays(first, daysInMonth - 1)).map((r) => r.date), svc.getRecordsForMonth(yy, mm).map((r) => r.date)));
  const latest = Object.keys(app.store.getVivaState().dailyLogs).sort().pop();
  check('latest tracked date', svc.getLatestTrackedDate() === latest);
  check('createDailyRecord is empty and not stored', svc.createDailyRecord(D(-90)).mood === null && !svc.hasDailyRecord(D(-90)));

  console.log('TEST 4 - empty record cleanup');
  const far = D(-400);
  await svc.updateDailyTrackingField(far, 'mood', 'low');
  check('a lone record gets its own month key', memory.has(DAY + far.slice(0, 7)));
  await svc.clearDailyRecordField(far, 'mood');
  check('cleared: record, empty month key and index entry all removed', !memory.has(DAY + far.slice(0, 7)) && !core().dailyMonths.includes(far.slice(0, 7)));
  await svc.clearDailyRecordField(day, 'mood');
  await svc.clearDailyRecordField(day, 'energy');
  await flow.saveFlow(day, null);
  await sym.saveSymptoms(day, null);
  await mucus.saveMucus(day, null);
  await sex.saveSexualActivity(day, null);
  await meds.deleteMedication(day, med.id);
  await svc.clearDailyRecordField(day, 'period');
  check('a day with every field cleared is removed from storage', !(day in bucket(day.slice(0, 7))));

  console.log('TEST 6 - storage failure');
  const before = snap();
  failAfter = setCount;
  check('failure reported', (await svc.updateDailyTrackingField(b, 'mood', 'great')) === 'failed');
  check('phone data untouched, screen rolled back', snap() === before && svc.readDailyRecord(b).mood === 'low');
  failAfter = Infinity;
  check('retry succeeds', (await svc.updateDailyTrackingField(b, 'mood', 'great')) === 'saved');

  console.log('INTERRUPTED MULTI-MONTH WRITE (phone dies halfway)');
  const B = dates.addDays(D(-40).slice(0, 8) + '01', 0);
  const s = dates.addDays(B, -2), e = dates.addDays(B, 1);
  failAfter = setCount + 2; // journal + first month written, then the "phone dies"
  check('the write reports failure', (await period.savePeriodRange(s, e)) === 'failed');
  check('a journal was left behind', memory.has('viva-cycle:journal'));
  failAfter = Infinity;
  app = await load();
  check('next launch finishes the whole change (both months)', app.period.getPeriodInfo(s).status === 'period' && app.period.getPeriodInfo(e).episode.recordedDays === 4);
  check('journal cleared', !memory.has('viva-cycle:journal'));

  console.log('TEST 5 - migration from the old single-blob format');
  memory.clear();
  const X = D(-100), Y = D(-200);
  const oldBlob = JSON.stringify({
    version: 2, setupComplete: true, name: 'T', dateOfBirth: null,
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null, periods: [], reminders: {},
    dailyLogs: {
      [X]: { date: X, mood: 'veryLow', cervicalMucus: 'eggWhite', sexualActivity: 'protected', medications: ['iron'], symptoms: ['cramps', 'cramps'], period: 'yes' },
      [Y]: { date: Y, mood: 'good', energy: 40 },
    },
  });
  memory.set('viva-cycle:data', oldBlob);
  app = await load();
  const mx = bucket(X.slice(0, 7))[X];
  check('records moved into month keys with schemaVersion 1', mx && mx.schemaVersion === 1 && bucket(Y.slice(0, 7))[Y].schemaVersion === 1);
  check('older values converted, nothing lost', mx.mood === 'very_low' && mx.cervicalMucus === 'egg_white' && eq(mx.sexualActivity, { status: 'activity', entries: [{ protection: 'used' }] }) && mx.medications[0].name === 'Iron' && eq(mx.symptoms, ['cramps']) && mx.period === 'yes' && bucket(Y.slice(0, 7))[Y].energy === 40, mx);
  check('profile upgraded to version 3, no records inside', core().version === 3 && !('dailyLogs' in core()) && core().setupComplete === true);
  check('the old data is kept in the backup key', plain(memory.get('viva-cycle:data-backup'), 'viva-cycle:data-backup') === oldBlob);
  writes = [];
  app = await load();
  check('next launch reads the new format without rewriting months', writes.filter((k) => k.startsWith(DAY)).length === 0, writes);
  check('data identical after migration', app.svc.readDailyRecord(X).mood === 'very_low' && app.period.getPeriodInfo(X).status === 'period');

  console.log('DAMAGED DATA');
  memory.clear();
  const m1 = D(-100).slice(0, 7), m2 = D(-200).slice(0, 7);
  memory.set('viva-cycle:data', JSON.stringify({ version: 3, layout: 'monthly', dailyMonths: [m2, m1], setupComplete: true, name: 'T', dateOfBirth: null, baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null, periods: [], reminders: {} }));
  memory.set(DAY + m1, JSON.stringify({ [D(-100)]: { date: D(-100), mood: 'banana', energy: 'x', flow: 'light', schemaVersion: 1 } }));
  memory.set(DAY + m2, 'not json{');
  app = await load();
  check('the app still loads', app.store.getVivaState().loaded && !app.store.getVivaState().loadError);
  const rr = app.svc.readDailyRecord(D(-100));
  check('bad fields ignored, good field kept', rr.flow === 'light' && rr.mood === null && rr.energy === null, rr);
  check('the unreadable month is set aside untouched, never deleted', plain(memory.get('viva-cycle:damaged:' + m2), 'viva-cycle:damaged:' + m2) === 'not json{');

  console.log('TEST 7 - three years of history');
  memory.clear();
  const logs = {};
  const moods = ['very_low', 'low', 'okay', 'good', 'great'];
  for (let i = 1; i <= 1095; i++) {
    const d = D(-i);
    logs[d] = app.model.normalizeRecord(d, {
      mood: moods[i % 5], energy: (i * 7) % 101, symptoms: i % 3 === 0 ? ['cramps'] : null,
      period: i % 28 < 5 ? 'yes' : null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }
  const months = app.storage.serializeMonths(logs);
  months.forEach((json, m) => memory.set(DAY + m, json));
  memory.set('viva-cycle:data', JSON.stringify({ version: 3, layout: 'monthly', dailyMonths: [...months.keys()], setupComplete: true, name: 'T', dateOfBirth: null, baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null, periods: [], reminders: {} }));
  let t0 = performance.now();
  app = freshApp();
  await app.store.loadVivaStore();
  const tLoad = performance.now() - t0;
  await settle();
  check('1,095 records loaded in ' + Math.round(tLoad) + ' ms (budget 3000)', Object.keys(app.store.getVivaState().dailyLogs).length === 1095 && tLoad < 3000);
  const mid = D(-500);
  t0 = performance.now();
  const monthRecs = app.svc.getRecordsForMonth(Number(mid.slice(0, 4)), Number(mid.slice(5, 7)));
  const tMonth = performance.now() - t0;
  check('one month (' + monthRecs.length + ' records) in ' + tMonth.toFixed(1) + ' ms', monthRecs.length >= 28 && tMonth < 100);
  t0 = performance.now();
  for (let i = 1; i <= 200; i++) app.svc.readDailyRecord(D(-i));
  const tNav = performance.now() - t0;
  check('200 date switches in ' + Math.round(tNav) + ' ms', tNav < 500);
  t0 = performance.now();
  const yearRecs = app.svc.getRecordsForDateRange(D(-365), D(-1));
  check('one-year range (' + yearRecs.length + ') in ' + Math.round(performance.now() - t0) + ' ms', yearRecs.length === 365 && performance.now() - t0 < 500);
  writes = [];
  const target = D(-10);
  const newMood = app.svc.readDailyRecord(target).mood === 'great' ? 'low' : 'great';
  t0 = performance.now();
  await app.svc.updateDailyTrackingField(target, 'mood', newMood);
  const tSave = performance.now() - t0;
  check('saving one day writes ONLY its month (' + writes.join(', ') + ') in ' + Math.round(tSave) + ' ms', eq(writes, [DAY + target.slice(0, 7)]) && tSave < 1000, writes);
  const total = [...memory.entries()].filter(([k]) => k.startsWith(DAY)).reduce((n, [, v]) => n + v.length, 0);
  check('that write is a small slice of the history', memory.get(DAY + target.slice(0, 7)).length * 20 < total);

  console.log('PRIVACY - no health data in logs');
  const files = ['lib/vivaStore.ts', 'lib/dailyStorage.ts', 'lib/dailyTrackingService.ts', 'lib/useDailyTracking.ts', 'lib/periodService.ts', 'lib/flowService.ts', 'lib/symptomService.ts', 'lib/mucusService.ts', 'lib/sexualActivityService.ts', 'lib/medicationService.ts'];
  const text = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  check('no console.log / info / debug in the data layer', !/console\.(log|info|debug)\(/.test(text));
  check('warnings never pass data or error objects', !/console\.warn\([^)\n]*,/.test(text));

  console.warn = realWarn;
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.warn = realWarn; console.error('TEST RUN CRASHED:', e); process.exit(1); });
