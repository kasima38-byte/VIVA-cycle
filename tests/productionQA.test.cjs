// Production QA - Prompt 17 (data level; the screen itself needs the phone)
// Run: npx --yes tsx tests/productionQA.test.cjs
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
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
    ins: require('../lib/insightsService'),
    set: require('../lib/dailyTrackingSettingsService'),
    setm: require('../lib/dailyTrackingSettings'),
    engine: require('../lib/cycleEngine'),
    storage: require('../lib/dailyStorage'),
    symlib: require('../lib/symptoms'),
    model: require('../lib/dailyTracking'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function restart() {
  const app = freshApp();
  await app.store.loadVivaStore();
  await app.set.loadTrackingSettings();
  await settle();
  return app;
}
async function fresh() { memory.clear(); return restart(); }

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const DAY = 'viva-cycle:daily:';
const disk = (d) => {
  const r = JSON.parse(memory.get(DAY + d.slice(0, 7)) || '{}')[d];
  if (!r) return null;
  const { schemaVersion: _v, ...rest } = r;
  return rest;
};
const snap = () => JSON.stringify([...memory.entries()].sort());

async function main() {
  let app = await fresh();
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const rec = (d) => app.svc.readDailyRecord(d);
  const consistent = (d) => JSON.stringify(app.store.getVivaState().dailyLogs[d] ?? null) === JSON.stringify(disk(d));
  const S = (d, f, v) => app.svc.updateDailyTrackingField(d, f, v);

  console.log('2 / 3 - DATE ISOLATION, rapid switching');
  const [d6, d7, d8, fut] = [D(-3), D(-2), D(-1), D(2)];
  await S(d6, 'mood', 'good'); await S(d7, 'mood', 'low'); await S(d8, 'mood', 'great');
  let leaks = 0;
  const want = { [d6]: 'good', [d7]: 'low', [d8]: 'great', [fut]: null };
  for (let i = 0; i < 50; i++) for (const d of [d8, d7, d6, d8, fut, d7]) if (rec(d).mood !== want[d]) leaks++;
  check('each date always shows its own value (300 switches)', leaks === 0, leaks);

  console.log('4 / 5 / 6 - RAPID EDITS: the latest wins');
  await Promise.all(['good', 'great', 'okay', 'low', 'great'].map((m) => S(d8, 'mood', m)));
  check('mood ends Great, on screen and on the phone', rec(d8).mood === 'great' && disk(d8).mood === 'great');
  await Promise.all([30, 55, 72, 91, 64].map((v) => S(d8, 'energy', v)));
  check('energy ends 64, on screen and on the phone', rec(d8).energy === 64 && disk(d8).energy === 64);
  const picks = [['cramps'], ['cramps', 'headache'], ['cramps', 'headache', 'bloating'], ['headache', 'bloating'], ['headache', 'bloating', 'migraine'], ['bloating', 'migraine']];
  await Promise.all(picks.map((p) => app.sym.saveSymptoms(d8, p)));
  check('symptoms end exactly Migraine + Bloating, no duplicates', eq(disk(d8).symptoms, ['migraine', 'bloating']) && eq(rec(d8).symptoms, ['migraine', 'bloating']), disk(d8).symptoms);

  console.log('7 / 56 - SEVERAL FIELDS SAVED AT ONCE');
  await Promise.all([S(d7, 'mood', 'great'), S(d7, 'energy', 75), app.sym.saveSymptoms(d7, ['cramps']), app.flow.saveFlow(d7, 'light')]);
  const r7 = disk(d7);
  check('all four survive (no stale snapshot overwrote another)', r7.mood === 'great' && r7.energy === 75 && eq(r7.symptoms, ['cramps']) && r7.flow === 'light', r7);
  check('one record per date', Object.keys(JSON.parse(memory.get(DAY + d7.slice(0, 7)))).filter((k) => k === d7).length === 1);

  console.log('8 / 9 / 10 - MERGE, CLEAR ONE, CLEAR ALL');
  await S(d7, 'mood', 'low');
  check('changing mood keeps energy and symptoms', rec(d7).energy === 75 && eq(rec(d7).symptoms, ['cramps']));
  await app.svc.clearDailyRecordField(d7, 'mood');
  check('clearing mood keeps the rest', rec(d7).mood === null && rec(d7).energy === 75 && eq(rec(d7).symptoms, ['cramps']));
  const others = JSON.stringify([disk(d6), disk(d8)]);
  for (const f of ['energy', 'symptoms', 'flow']) await app.svc.clearDailyRecordField(d7, f);
  check('emptied day removed; other days untouched', disk(d7) === null && JSON.stringify([disk(d6), disk(d8)]) === others);

  console.log('57 - EDITS ON TWO DATES AT ONCE');
  await Promise.all([S(d6, 'energy', 41), S(d8, 'energy', 88)]);
  check('each date gets only its own change', disk(d6).energy === 41 && disk(d8).energy === 88 && disk(d6).mood === 'good' && disk(d8).mood === 'great');

  console.log('11 / 12 / 13 / 14 / 15 - PERIOD + INDEPENDENCE');
  await app.period.markPeriodDay(D(-60));
  const [p0, p1, p2] = [D(-20), D(-19), D(-18)];
  await app.period.savePeriodRange(p0, p2);
  check('3 recorded bleeding days in one episode', app.period.getPeriodInfo(p1).episode.recordedDays === 3);
  await S(p2, 'mood', 'good');
  await app.period.removePeriodDay(p1);
  check('removing the middle day breaks the episode in two', app.period.getPeriodInfo(p0).episode.recordedDays === 1 && app.period.getPeriodInfo(p2).dayNumber === 1);
  await app.period.removePeriodDay(p2);
  check('editing a period day keeps its other fields', rec(p2).period === null && rec(p2).mood === 'good');
  await app.flow.saveFlow(D(-25), 'spotting');
  check('spotting without a period is allowed', app.period.getPeriodInfo(D(-25)).status === 'untracked' && rec(D(-25)).flow === 'spotting');
  await app.flow.saveFlow(p0, 'heavy'); await app.flow.saveFlow(p0, null);
  check('period without flow; clearing flow keeps the period', app.period.getPeriodInfo(p0).status === 'period' && rec(p0).flow === null);
  await app.sym.saveSymptoms(p0, ['cramps']); await app.period.removePeriodDay(p0);
  check('clearing the period keeps symptoms', eq(rec(p0).symptoms, ['cramps']));
  await app.period.markPeriodDay(p0); await app.sym.saveSymptoms(p0, null);
  check('clearing symptoms keeps the period', app.period.getPeriodInfo(p0).status === 'period');
  await S(D(-5), 'mood', 'great'); await S(D(-5), 'energy', 80); await S(D(-5), 'mood', 'low');
  check('mood change keeps energy', rec(D(-5)).energy === 80);
  await app.svc.clearDailyRecordField(D(-5), 'energy');
  check('clearing energy keeps mood', rec(D(-5)).mood === 'low');

  console.log('16 / 17 - NOTHING INFERRED FROM MUCUS OR SEXUAL ACTIVITY');
  const st = () => app.store.getVivaState();
  const est = () => { try { return JSON.stringify(app.engine.calculateCycle(st().baseline, st().periods, today)); } catch (e) { return 'error'; } };
  const before = est(); const starts = JSON.stringify(st().periods);
  await app.mucus.saveMucus(D(-8), 'egg_white'); await app.sex.saveSexualActivity(D(-8), 'activity', 'not_used');
  check('cycle estimate, period history and the day itself unchanged', est() === before && JSON.stringify(st().periods) === starts && rec(D(-8)).period === null);

  console.log('18 / 19 / 20 - MEDICATIONS');
  const md = D(-4);
  const A = await app.meds.addMedication(md, { name: 'Medication A' });
  const B = await app.meds.addMedication(md, { name: 'Medication B', dose: '1' });
  const C = await app.meds.addMedication(md, { name: 'Medication C' });
  const aBefore = JSON.stringify(app.meds.getMedications(md)[0]); const cBefore = JSON.stringify(app.meds.getMedications(md)[2]);
  await app.meds.updateMedication(md, B.id, { name: 'Medication B', dose: '2' });
  check('editing B leaves A and C untouched', JSON.stringify(app.meds.getMedications(md)[0]) === aBefore && JSON.stringify(app.meds.getMedications(md)[2]) === cBefore);
  await app.meds.deleteMedication(md, B.id);
  check('deleting B leaves A and C', eq(app.meds.getMedications(md).map((e) => e.id), [A.id, C.id]));
  const i1 = await app.meds.addMedication(md, { name: 'Ibuprofen' }); const i2 = await app.meds.addMedication(md, { name: 'Ibuprofen' });
  check('same name twice = two entries with their own IDs', i1.id !== i2.id && app.meds.getMedications(md).filter((e) => e.name === 'Ibuprofen').length === 2);
  check('empty name refused; missing dose fine; bad dose and bad time refused - no crash',
    (await app.meds.addMedication(md, { name: '  ' })).result === 'missingName' && (await app.meds.addMedication(D(-6), { name: 'Iron' })).result === 'saved'
    && (await app.meds.addMedication(md, { name: 'X', dose: 'abc' })).result === 'invalidDose' && (await app.meds.addMedication(md, { name: 'X', time: '25:99' })).result === 'invalid');

  console.log('22 / 61 - NOT TRACKED IS NEVER "NO"');
  const blank = rec(D(-40));
  check('a new day is all null', app.model.TRACKED_FIELDS.every((f) => blank[f] === null));
  const card = (r, f) => app.model.fieldSummary(r, f);
  check('explicit answers stay distinct from Not tracked',
    card(app.model.normalizeRecord(D(-40), { flow: 'none' }), 'flow') === 'No bleeding' && card(blank, 'flow') === 'Not tracked'
    && card(app.model.normalizeRecord(D(-40), { symptoms: [] }), 'symptoms') === 'No symptoms' && card(blank, 'symptoms') === 'Not tracked'
    && card(blank, 'cervicalMucus') === 'Not tracked' && card(blank, 'sexualActivity') === 'Not tracked' && card(blank, 'mood') === 'Not tracked');

  console.log('23 - FUTURE DATES');
  const todayBefore = JSON.stringify(rec(today));
  const results = [await S(fut, 'mood', 'good'), await app.flow.saveFlow(fut, 'light'), await app.sym.saveSymptoms(fut, ['cramps']),
    await app.mucus.saveMucus(fut, 'dry'), await app.sex.saveSexualActivity(fut, 'none'), (await app.meds.addMedication(fut, { name: 'X' })).result,
    await app.period.markPeriodDay(fut)];
  check('every category refuses a future date', results.every((r) => r === 'future'), results);
  check('nothing written to the future date or to today', disk(fut) === null && JSON.stringify(rec(today)) === todayBefore);

  console.log('24 - HISTORICAL EDIT (5 months ago)');
  const H = D(-150);
  await S(H, 'mood', 'okay');
  check('right date updated, today untouched, Insights see it, updatedAt set', rec(H).mood === 'okay' && JSON.stringify(rec(today)) === todayBefore && app.ins.getInsights(H, H).mood.recordedDays === 1 && typeof rec(H).updatedAt === 'string');

  console.log('25 / 26 / 27 - BOUNDARY DATES STAY SEPARATE');
  for (const d of ['2025-12-31', '2026-01-01', '2026-01-31', '2026-02-01', '2024-02-28', '2024-02-29']) await S(d, 'mood', 'okay');
  check('each boundary date is its own record in its own month', ['2025-12-31', '2026-01-01', '2026-01-31', '2026-02-01', '2024-02-28', '2024-02-29'].every((d) => disk(d) && disk(d).date === d));

  console.log('55 - SCREEN = MEMORY = PHONE for every saved date');
  const allDates = Object.keys(app.store.getVivaState().dailyLogs);
  check('all ' + allDates.length + ' dates consistent', allDates.every(consistent), allDates.filter((d) => !consistent(d)));

  console.log('34 - STORAGE FAILURE in every category');
  const beforeFail = snap(); const d8Before = JSON.stringify(rec(d8));
  failing = true;
  const fails = [await S(d8, 'mood', 'okay'), await app.flow.saveFlow(d8, 'medium'), await app.sym.saveSymptoms(d8, ['acne']),
    await app.mucus.saveMucus(d8, 'sticky'), await app.sex.saveSexualActivity(d8, 'none'), (await app.meds.addMedication(d8, { name: 'Y' })).result,
    await app.period.markPeriodDay(d8)];
  failing = false;
  check('every category reports failure (no false success)', fails.every((r) => r === 'failed'), fails);
  check('phone data untouched and screen shows what is really saved', snap() === beforeFail && JSON.stringify(rec(d8)) === d8Before);
  check('retry works', (await S(d8, 'mood', 'okay')) === 'saved' && disk(d8).mood === 'okay');

  console.log('35 - CORRUPTED RECORDS never crash and never become values');
  const bad = app.model.normalizeRecord(D(-30), {
    mood: 'banana', energy: 500, flow: 'LIGHT', symptoms: ['cramps', 'cramps', 42, null], cervicalMucus: 'eggs',
    sexualActivity: { status: 'maybe' }, medications: [{}, { name: '' }, null, { name: 'Iron', time: '25:99', dose: 7 }], period: 'sometimes',
  });
  check('invalid fields ignored, valid parts kept', bad.mood === null && bad.energy === null && bad.flow === null && eq(bad.symptoms, ['cramps']) && bad.cervicalMucus === null && bad.sexualActivity === null && bad.medications.length === 1 && bad.medications[0].name === 'Iron' && bad.medications[0].time === null && bad.medications[0].dose === null && bad.period === null, bad);
  check('energy -50 and 500 are not recorded (never clamped)', app.model.normalizeRecord(D(-30), { energy: -50 }).energy === null && app.model.normalizeRecord(D(-30), { energy: 500 }).energy === null);
  check('a record that is not even an object is just empty', app.model.TRACKED_FIELDS.every((f) => app.model.normalizeRecord(D(-30), 'garbage')[f] === null && app.model.normalizeRecord(D(-30), null)[f] === null));
  check('unknown symptom IDs are kept, not crashed on', app.symlib.symptomLabel('futureSymptom') === 'futureSymptom');

  console.log('36 - MIGRATION keeps every field');
  const old = app.storage.migrateRecord({ date: D(-30), mood: 'good', energy: 50, unknownFutureField: 'kept' });
  check('version 0 record upgraded with nothing dropped', old.mood === 'good' && old.energy === 50 && old.unknownFutureField === 'kept' && !('schemaVersion' in old));

  console.log('41 / 42 / 43 - SETTINGS AND CLEAR');
  const dataBefore = snap();
  for (const k of ['moodEnabled', 'energyEnabled', 'symptomsEnabled']) await app.set.updateSetting(k, false);
  check('three categories hidden', app.setm.visibleFields(app.set.getSettings()).length === 5);
  app = await restart();
  check('still hidden after restart, data untouched', app.setm.visibleFields(app.set.getSettings()).length === 5 && JSON.stringify([...memory.entries()].filter(([k]) => k.startsWith(DAY)).sort()) === JSON.stringify(JSON.parse(dataBefore).filter(([k]) => k.startsWith(DAY))));
  await app.set.resetSettings();
  check('reset shows everything; data and Insights intact', app.setm.visibleFields(app.set.getSettings()).length === 8 && app.svc.readDailyRecord(d8).mood === 'okay' && app.ins.getInsights(H, H).mood.recordedDays === 1);
  const s1 = snap(); app.svc.getClearSummary(); app.svc.getClearSummary();
  check('opening the clear summary (twice) changes nothing', snap() === s1);

  console.log('44 - DOUBLE TAPS');
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const guarded = ['components/PeriodSheet.tsx', 'components/FlowSheet.tsx', 'components/SymptomsSheet.tsx', 'components/MucusSheet.tsx',
    'components/SexualActivitySheet.tsx', 'components/MedicationsSheet.tsx'].filter((f) => !/if \(busy\) return;/.test(read(f)));
  check('every sheet ignores a second tap while saving', guarded.length === 0, guarded);
  check('Save returns the running save instead of starting another', /if \(inFlight\.current\) return inFlight\.current;/.test(read('lib/useDailyTracking.ts')));
  check('Clear Data ignores a second tap', /if \(clearing\) return;/.test(read('app/daily-tracking-settings.tsx')));
  check('Calendar taps: one tap = one change', /if \(tapBusy\.current\) return;/.test(read('app/(tabs)/calendar.tsx')));

  console.log('45 / 46 - OFFLINE');
  const trackingFiles = fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => /ailyTracking|eriod|low|ymptom|ucus|exual|edication|nsight|Storage|vivaStore/.test(f)).map((f) => 'lib/' + f);
  const net = trackingFiles.filter((f) => /\bfetch\(|XMLHttpRequest|axios/.test(read(f)));
  check('Daily Tracking, storage and Insights never use the network', net.length === 0, net);

  console.log('52 / 53 / 60 / 63 - PRIVACY, ERRORS, CLAIMS, TYPES (whole app)');
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(dir + '/' + e.name) : /\.tsx?$/.test(e.name) ? [dir + '/' + e.name] : []));
  const code = ['app', 'components', 'lib', 'constants'].flatMap(walk);
  const logFiles = code.filter((f) => /console\.(log|info|debug)\(/.test(read(f)));
  check('no console.log / info / debug anywhere in the app', logFiles.length === 0, logFiles);
  const ui = code.filter((f) => f.startsWith('app') || f.startsWith('components'));
  const tech = ui.filter((f) => /['"`][^'"`\n]*(AsyncStorage|TypeError|undefined is|Error code|stack trace)[^'"`\n]*['"`]/.test(read(f)));
  check('no technical error text shown to users', tech.length === 0, tech);
  const claims = ui.concat(['lib/insights.ts']).filter((f) => /you are fertile|you ovulated|your hormones|abnormal|you are pregnant/i.test(read(f)));
  check('no unsupported medical claims in the UI or Insights', claims.length === 0, claims);
  const ours = ['lib/dailyTracking.ts', 'lib/dailyTrackingService.ts', 'lib/useDailyTracking.ts', 'lib/periodTracking.ts', 'lib/periodService.ts', 'lib/flowTracking.ts', 'lib/flowService.ts', 'lib/symptoms.ts', 'lib/symptomService.ts', 'lib/moodTracking.ts', 'lib/energyTracking.ts', 'lib/cervicalMucus.ts', 'lib/mucusTracking.ts', 'lib/mucusService.ts', 'lib/sexualActivity.ts', 'lib/sexualActivityService.ts', 'lib/medications.ts', 'lib/medicationService.ts', 'lib/dailyStorage.ts', 'lib/insights.ts', 'lib/insightsService.ts', 'lib/dailyTrackingSettings.ts', 'lib/dailyTrackingSettingsService.ts', 'lib/useReducedMotion.ts'];
  const noComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const anys = ours.filter((f) => /:\s*any\b|\bas any\b/.test(noComments(read(f))));
  check('no "any" types in the Daily Tracking code', anys.length === 0, anys);

  console.log('37 / 38 / 39 / 40 - INSIGHTS ACCURACY (fresh data)');
  app = await fresh();
  const s1d = D(-150), s2d = app.dates.addDays(s1d, 28), s3d = app.dates.addDays(s2d, 29), s4d = app.dates.addDays(s3d, 27);
  await app.period.savePeriodRange(s1d, app.dates.addDays(s1d, 3));
  check('only one period start: cycle length Not enough data', app.ins.getInsightsForRange('last_12_months').cycles.averageCycleLengthText === 'Not enough data');
  await app.period.savePeriodRange(s2d, app.dates.addDays(s2d, 4));
  await app.period.savePeriodRange(s3d, app.dates.addDays(s3d, 2));
  await app.period.markPeriodDay(s4d);
  const all = app.ins.getInsightsForRange('last_6_cycles');
  check('cycles 28, 29, 27 -> average exactly 28', eq(app.ins.getCycleHistory().slice(0, 3).map((c) => c.cycleLength), [28, 29, 27]) && all.cycles.averageCycleLength === 28);
  check('periods 4, 5, 3 -> average exactly 4', all.cycles.averagePeriodLength === 4);
  await S(D(-10), 'energy', 70); await S(D(-9), 'energy', 72); await S(D(-7), 'energy', 68);
  check('missing day stays null in the series', eq(app.ins.getEnergySeries(D(-10), D(-7)).map((p) => p.value), [70, 72, null, 68]));
  const i1x = app.ins.getInsights(D(-10), D(-7)); await S(D(-8), 'energy', 90);
  check('Insights recalculate after a change', app.ins.getInsights(D(-10), D(-7)) !== i1x && app.ins.getInsights(D(-10), D(-7)).energy.highest === 90);

  console.log('49 / 50 / 51 - A FULL YEAR, MANY MEDICATIONS, MANY SYMPTOMS');
  memory.clear();
  const logs = {};
  const moods = ['very_low', 'low', 'okay', 'good', 'great'];
  for (let i = 1; i <= 365; i++) {
    const d = D(-i);
    logs[d] = app.model.normalizeRecord(d, {
      period: i % 28 < 5 ? 'yes' : null, flow: i % 28 < 5 ? 'medium' : i % 28 === 14 ? 'spotting' : null,
      symptoms: i % 4 === 0 ? ['cramps', 'headache'] : null, mood: moods[i % 5], energy: (i * 13) % 101,
      cervicalMucus: i % 7 === 0 ? 'creamy' : null, sexualActivity: i % 9 === 0 ? { status: 'activity', entries: [{ protection: null }] } : null,
      medications: i % 10 === 0 ? [{ id: 'm' + i, name: 'Iron' }] : null,
    });
  }
  const months = app.storage.serializeMonths(logs);
  months.forEach((json, m) => memory.set(DAY + m, json));
  memory.set('viva-cycle:data', JSON.stringify({ version: 3, layout: 'monthly', dailyMonths: [...months.keys()], setupComplete: true, name: 'T', dateOfBirth: null, baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null, periods: [], reminders: {} }));
  let t0 = performance.now();
  app = await restart();
  const tLoad = performance.now() - t0;
  t0 = performance.now();
  for (let i = 1; i <= 365; i++) app.svc.readDailyRecord(D(-i));
  const tNav = performance.now() - t0;
  t0 = performance.now();
  const year = app.ins.getInsightsForRange('last_12_months');
  const tIns = performance.now() - t0;
  check('a full year (all 8 categories) loads in ' + Math.round(tLoad) + ' ms, 365 date switches in ' + Math.round(tNav) + ' ms, Insights in ' + Math.round(tIns) + ' ms',
    Object.keys(app.store.getVivaState().dailyLogs).length === 365 && tLoad < 3000 && tNav < 500 && tIns < 1500 && year.cycles.completedCycles >= 10);
  const many = D(-400);
  for (let i = 0; i < 20; i++) await app.meds.addMedication(many, { name: 'Medication ' + i });
  check('20 medications on one day; the 21st is refused politely', app.meds.getMedications(many).length === 20 && (await app.meds.addMedication(many, { name: 'One more' })).result === 'tooMany');
  const every = app.symlib.SYMPTOMS.filter((s) => !s.retired).map((s) => s.id);
  await app.sym.saveSymptoms(many, [...every, ...every]);
  check('all 22 symptoms selected (twice) -> 22 unique IDs', app.sym.getSymptoms(many).length === 22 && new Set(app.sym.getSymptoms(many)).size === 22);

  console.log('66 - USER JOURNEYS (data level)');
  app = await fresh();
  await app.period.markPeriodDay(today); await S(today, 'mood', 'good'); await S(today, 'energy', 65);
  app = await restart();
  check('A new user: period, mood, energy survive leaving and restarting', app.period.getPeriodInfo(today).status === 'period' && rec(today).mood === 'good' && rec(today).energy === 65);
  await app.sym.saveSymptoms(D(-12), ['cramps']); await S(D(-12), 'mood', 'low');
  check('B historical edit shows in Insights', app.ins.getInsights(D(-12), D(-12)).symptoms.ranking[0].id === 'cramps' && app.ins.getInsights(D(-12), D(-12)).mood.distribution.low === 1);
  await app.period.savePeriodRange(D(-45), D(-41)); await app.period.savePeriodRange(D(-45), D(-42), D(-43)); await app.period.removePeriodDay(D(-44));
  const ch = app.ins.getCycleHistory();
  check('C period range edited and one day cleared: history consistent', ch[0].startDate === D(-45) && ch[0].recordedPeriodDays === 1 && app.period.getPeriodInfo(D(-43)).dayNumber === 1);
  await app.sex.saveSexualActivity(D(-3), 'activity', 'used'); const m = await app.meds.addMedication(D(-3), { name: 'Ibuprofen', dose: '200', unit: 'mg' });
  app = await restart();
  check('D sensitive data persists after restart', app.sex.getSexualActivity(D(-3)).entries[0].protection === 'used' && app.meds.getMedications(D(-3))[0].id === m.id);
  await app.set.updateSetting('moodEnabled', false); await app.set.updateSetting('symptomsEnabled', false);
  app = await restart();
  check('E hidden after restart', !app.setm.isFieldVisible(app.set.getSettings(), 'mood') && !app.setm.isFieldVisible(app.set.getSettings(), 'symptoms'));
  await app.set.updateSetting('moodEnabled', true); await app.set.updateSetting('symptomsEnabled', true);
  check('E re-enabled: values still there', rec(D(-12)).mood === 'low' && eq(rec(D(-12)).symptoms, ['cramps']));
  failing = true;
  const fr = await S(today, 'mood', 'great');
  failing = false;
  check('F failure reported, saved value still shown, retry works', fr === 'failed' && rec(today).mood === 'good' && (await S(today, 'mood', 'great')) === 'saved');

  console.warn = realWarn;
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.warn = realWarn; console.error('TEST RUN CRASHED:', e); process.exit(1); });
