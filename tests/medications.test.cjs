// Medications - Prompt 9 tests, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/medications.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
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

async function main() {
  let app = freshApp();
  await app.store.loadVivaStore();
  let { svc, period, flow, sym, mucus, sex, meds, model } = app;
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const other = D(-1), P = D(-5), P2 = D(-6);
  const rec = (d) => svc.readDailyRecord(d);
  const card = (d) => model.fieldSummary(rec(d), 'medications');
  const names = (d) => meds.getMedications(d).map((e) => e.name);

  console.log('OLDER SAVED VALUES');
  const old = model.normalizeRecord(D(-40), { medications: ['iron', 'painRelief'] }).medications;
  check('earlier chips become named entries', eq(old.map((e) => e.name), ['Iron', 'Pain relief']), old);
  check('their IDs are stable between reads', eq(old.map((e) => e.id), model.normalizeRecord(D(-40), { medications: ['iron', 'painRelief'] }).medications.map((e) => e.id)));
  check('an empty list is stored as Not tracked (null)', model.normalizeRecord(D(-40), { medications: [] }).medications === null);

  console.log('TEST 1 - untracked date');
  check('Not tracked', rec(today).medications === null && card(today) === 'Not tracked');

  console.log('NAME IS REQUIRED');
  check('no name refused', (await meds.addMedication(today, { name: '' })).result === 'missingName');
  check('spaces-only name refused', (await meds.addMedication(today, { name: '   ', dose: '400' })).result === 'missingName');
  check('nothing was saved', rec(today).medications === null);

  console.log('TEST 2 / 3 - Ibuprofen 400 mg');
  const add1 = await meds.addMedication(today, { name: 'Ibuprofen', dose: '400', unit: 'mg' });
  check('saved', add1.result === 'saved' && typeof add1.id === 'string');
  check('card shows "1 recorded"', card(today) === '1 recorded', card(today));
  const e1 = meds.getMedications(today)[0];
  check('structured: dose and unit apart, time not filled in', e1.name === 'Ibuprofen' && e1.dose === '400' && e1.unit === 'mg' && e1.time === null && e1.note === null, e1);

  console.log('TEST 4 - 400 mg -> 200 mg');
  check('updated', (await meds.updateMedication(today, add1.id, { name: 'Ibuprofen', dose: '200', unit: 'mg' })) === 'saved');
  check('same entry, same ID, no duplicate', meds.getMedications(today).length === 1 && meds.getMedications(today)[0].id === add1.id && meds.getMedications(today)[0].dose === '200');
  check('same values again writes nothing', (await meds.updateMedication(today, add1.id, { name: 'Ibuprofen', dose: '200', unit: 'mg' })) === 'unchanged');

  console.log('TEST 5 - add Iron 1 tablet');
  const add2 = await meds.addMedication(today, { name: 'Iron', dose: '1', unit: 'tablet' });
  check('card shows "2 recorded"', add2.result === 'saved' && card(today) === '2 recorded', card(today));
  check('first entry kept', eq(names(today), ['Ibuprofen', 'Iron']));

  console.log('TIME + NOTE');
  check('time stored as "HH:MM"', (await meds.addMedication(D(-2), { name: 'Paracetamol', time: '10:30', note: '  Taken after food ' })).result === 'saved' && meds.getMedications(D(-2))[0].time === '10:30');
  check('note trimmed and kept with its entry', meds.getMedications(D(-2))[0].note === 'Taken after food');
  check('display-style time refused', (await meds.addMedication(D(-2), { name: 'X', time: '10:30 AM' })).result === 'invalid');
  await meds.addMedication(D(-3), { name: 'Y', note: 'n'.repeat(400) });
  check('note limited to ' + app.store && 120 + ' characters', meds.getMedications(D(-3))[0].note.length === 120);

  console.log('PRIVACY + NO INFERENCE');
  check('card and screen-reader text show only a count', model.fieldFullText(rec(today), 'medications') === '2 recorded');
  check('adding Ibuprofen adds no symptom', rec(today).symptoms === null);
  const sheet = fs.readFileSync(path.join(ROOT, 'components/MedicationsSheet.tsx'), 'utf8');
  check('no recommendation or diagnosis wording in the sheet', !/recommend|diagnos|you should take|prescri/i.test(sheet));

  console.log('TEST 6 / 7 - other dates');
  check('another date has none', meds.getMedications(other).length === 0 && card(other) === 'Not tracked');
  check('original date keeps both', eq(names(today), ['Ibuprofen', 'Iron']));

  console.log('VALIDATION');
  check('future date refused', (await meds.addMedication(D(1), { name: 'Iron' })).result === 'future');
  check('no record created for the future date', !app.store.getVivaState().dailyLogs[D(1)]);
  check('unknown entry ID', (await meds.updateMedication(today, 'nope', { name: 'A' })) === 'notFound');

  console.log('TEST 11 - all eight coexist');
  await period.markPeriodDay(P);
  await flow.saveFlow(P, 'heavy');
  await sym.saveSymptoms(P, ['cramps']);
  await svc.updateDailyRecord(P, { mood: 'low', energy: 15 });
  await mucus.saveMucus(P, 'watery');
  await sex.saveSexualActivity(P, 'activity');
  await meds.addMedication(P, { name: 'Ibuprofen', dose: '400', unit: 'mg' });
  const r11 = rec(P);
  check('period, flow, symptoms, mood, energy, mucus, sexual activity, medication all kept',
    period.getPeriodInfo(P).status === 'period' && r11.flow === 'heavy' && eq(r11.symptoms, ['cramps']) && r11.mood === 'low' && r11.energy === 15 && r11.cervicalMucus === 'watery' && r11.sexualActivity.status === 'activity' && r11.medications[0].name === 'Ibuprofen', r11);

  console.log('TEST 12 / 13 / 14 + others - independence');
  const keep = JSON.stringify(rec(P).medications);
  await period.markPeriodDay(P2);
  await period.removePeriodDay(P2);
  check('after changing period: unchanged', JSON.stringify(rec(P).medications) === keep);
  await sym.saveSymptoms(P, ['cramps', 'headache']);
  check('after changing symptoms: unchanged', JSON.stringify(rec(P).medications) === keep);
  await svc.updateDailyRecord(P, { mood: 'great' });
  check('after changing mood: unchanged', JSON.stringify(rec(P).medications) === keep);
  await flow.saveFlow(P, 'light');
  await mucus.saveMucus(P, 'creamy');
  await sex.saveSexualActivity(P, null);
  check('after changing flow, mucus, sexual activity: unchanged', JSON.stringify(rec(P).medications) === keep);
  check('Daily Tracking Save cannot change them', (await svc.updateDailyRecord(P, { medications: null })) === 'unchanged' && JSON.stringify(rec(P).medications) === keep);
  await meds.addMedication(P, { name: 'Iron' });
  check('adding a medication leaves symptoms and mood alone', eq(rec(P).symptoms, ['headache', 'cramps']) && rec(P).mood === 'great');

  console.log('INSIGHTS DATA (no conclusions)');
  const freq = meds.getMedicationFrequency();
  const ibu = freq.find((f) => f.name === 'Ibuprofen');
  check('days per medication', ibu && ibu.days === 2 && freq.find((f) => f.name === 'Iron').days === 2, freq);

  console.log('TEST 10 - restart');
  app = freshApp();
  await app.store.loadVivaStore();
  check('entries survived with the same IDs', eq(app.meds.getMedications(today).map((e) => e.id), [add1.id, add2.id]));

  console.log('TEST 8 / 9 - delete one, then the other');
  check('Ibuprofen deleted', (await app.meds.deleteMedication(today, add1.id)) === 'saved' && eq(app.meds.getMedications(today).map((e) => e.name), ['Iron']));
  check('Iron deleted', (await app.meds.deleteMedication(today, add2.id)) === 'saved');
  const t = app.svc.readDailyRecord(today);
  check('Not tracked, and stored as null (no empty list left behind)', t.medications === null && app.model.fieldSummary(t, 'medications') === 'Not tracked');

  console.log('CLEAR ALL');
  check('clear all', (await app.meds.clearMedications(P)) === 'saved' && app.svc.readDailyRecord(P).medications === null);
  check('other answers on that day kept', app.svc.readDailyRecord(P).mood === 'great' && app.period.getPeriodInfo(P).status === 'period');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
