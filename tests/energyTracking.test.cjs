// Energy - Prompt 6 tests, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/energyTracking.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
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
    energy: require('../lib/energyTracking'),
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
  let { svc, period, flow, sym, model } = app;
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const other = D(-1), P = D(-5), P2 = D(-6);
  const rec = (d) => svc.readDailyRecord(d);
  const card = (d) => model.fieldSummary(rec(d), 'energy');

  console.log('MAPPING (one central function)');
  const map = [0, 20, 21, 40, 41, 60, 61, 65, 80, 81, 100].map((v) => v + '=' + model.getEnergyLabel(v));
  check('0-20 Very low, 21-40 Low, 41-60 Moderate, 61-80 High, 81-100 Very high', eq(map, [
    '0=Very low', '20=Very low', '21=Low', '40=Low', '41=Moderate', '60=Moderate',
    '61=High', '65=High', '80=High', '81=Very high', '100=Very high',
  ]), map);
  check('slider snaps to steps of 5 within 0-100', eq([72, 73, -5, 130].map(model.snapEnergy), [70, 75, 0, 100]));

  console.log('TEST 1 - untracked date');
  check('Energy = Not tracked (null, not 50)', rec(today).energy === null && card(today) === 'Not tracked', rec(today));

  console.log('TEST 2 / 3 - about 70, save');
  check('saved', (await svc.updateDailyRecord(today, { energy: 70 })) === 'saved');
  check('card shows "High", stored as the number 70', card(today) === 'High' && rec(today).energy === 70, rec(today));

  console.log('TEST 4 - about 20');
  check('saved', (await svc.updateDailyRecord(today, { energy: 20 })) === 'saved');
  check('card shows "Very low"', card(today) === 'Very low', card(today));

  console.log('TEST 5 / 6 - other dates do not inherit it');
  check('another date is still Not tracked', rec(other).energy === null && card(other) === 'Not tracked');
  await svc.updateDailyRecord(other, { energy: 45 });
  check('each date keeps its own value', rec(today).energy === 20 && rec(other).energy === 45 && card(other) === 'Moderate');

  console.log('DATA INTEGRITY');
  await svc.updateDailyRecord(D(-2), { energy: 'high' });
  check('text like "high" is never stored', rec(D(-2)).energy === null, rec(D(-2)));
  check('out-of-range values are refused, never clamped into a reading', (await svc.updateDailyRecord(D(-3), { energy: 150 })) !== 'saved' && rec(D(-3)).energy === null, rec(D(-3)));
  check('future date refused', (await svc.updateDailyRecord(D(1), { energy: 70 })) === 'future');
  check('no record created for the future date', !app.store.getVivaState().dailyLogs[D(1)]);

  console.log('TEST 9 - period + flow + symptoms + mood + energy coexist');
  await period.markPeriodDay(P);
  await flow.saveFlow(P, 'heavy');
  await sym.saveSymptoms(P, ['cramps']);
  await svc.updateDailyRecord(P, { mood: 'low', energy: 15 });
  check('all five kept', period.getPeriodInfo(P).status === 'period' && rec(P).flow === 'heavy' && eq(rec(P).symptoms, ['cramps']) && rec(P).mood === 'low' && rec(P).energy === 15 && card(P) === 'Very low', rec(P));

  console.log('TEST 10 / 11 / 12 - other changes never touch energy');
  await svc.updateDailyRecord(P, { mood: 'great' });
  check('after changing mood: 15', rec(P).energy === 15);
  await period.markPeriodDay(P2);
  await period.removePeriodDay(P2);
  check('after changing period: 15', rec(P).energy === 15);
  await flow.saveFlow(P, 'light');
  check('after changing flow: 15', rec(P).energy === 15);
  await sym.saveSymptoms(P, ['cramps', 'headache']);
  check('after changing symptoms: 15', rec(P).energy === 15);

  console.log('INSIGHTS DATA');
  const stats = app.energy.energyStats(app.store.getVivaState().dailyLogs);
  check('average, highest, lowest (numbers kept)', stats.count === 3 && stats.average === 26.7 && stats.highest === 45 && stats.highestDate === other && stats.lowest === 15 && stats.lowestDate === P, stats);
  const levels = app.energy.energyLevelCounts(app.store.getVivaState().dailyLogs);
  check('days per level', eq(levels, { 'Very low': 2, Low: 0, Moderate: 1, High: 0, 'Very high': 0 }), levels);

  console.log('TEST 8 - restart');
  app = freshApp();
  await app.store.loadVivaStore();
  check('energy values survived', app.svc.readDailyRecord(today).energy === 20 && app.svc.readDailyRecord(other).energy === 45 && app.svc.readDailyRecord(P).energy === 15);

  console.log('TEST 7 - clear');
  check('cleared', (await app.svc.updateDailyRecord(today, { energy: null })) === 'saved');
  check('card shows "Not tracked" and the value is null (not 50)', app.svc.readDailyRecord(today).energy === null && app.model.fieldSummary(app.svc.readDailyRecord(today), 'energy') === 'Not tracked');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
