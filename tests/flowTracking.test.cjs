// Flow / Spotting - Prompt 3 tests, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/flowTracking.test.cjs
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
    pt: require('../lib/periodTracking'),
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
  let { store, svc, period, flow, model } = app;
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const S = D(-11), P0 = D(-10), P1 = D(-9), P2 = D(-8), O = D(-3);
  const rec = (d) => svc.readDailyRecord(d);
  const card = (d) => model.fieldSummary(rec(d), 'flow');

  console.log('TEST 1 - today: Light');
  check('saved', (await flow.saveFlow(today, 'light')) === 'saved');
  check('card shows "Light"', card(today) === 'Light', card(today));

  console.log('TEST 2 - Light -> Heavy');
  check('saved', (await flow.saveFlow(today, 'heavy')) === 'saved');
  check('card shows "Heavy"', card(today) === 'Heavy', card(today));
  check('same value again writes nothing', (await flow.saveFlow(today, 'heavy')) === 'unchanged');
  check('one record for today (no duplicate)', Object.keys(store.getVivaState().dailyLogs).filter((k) => k === today).length === 1);

  console.log('TEST 3 - clear');
  check('cleared', (await flow.saveFlow(today, null)) === 'saved');
  check('card shows "Not tracked"', card(today) === 'Not tracked', card(today));

  console.log('TEST 4 - Period day + Heavy coexist');
  await period.markPeriodDay(P0);
  check('flow saved', (await flow.saveFlow(P0, 'heavy')) === 'saved');
  check('both kept', period.getPeriodInfo(P0).status === 'period' && rec(P0).flow === 'heavy', rec(P0));

  console.log('TEST 5 - Spotting without a period');
  const startsBefore = store.getVivaState().periods.map((p) => p.start);
  check('spotting saved', (await flow.saveFlow(S, 'spotting')) === 'saved');
  check('no period day created', period.getPeriodInfo(S).status === 'untracked', period.getPeriodInfo(S));
  check('period starts unchanged', eq(store.getVivaState().periods.map((p) => p.start), startsBefore));

  console.log('TEST 6 / 7 - each date keeps its own flow');
  await flow.saveFlow(O, 'medium');
  let leaks = 0;
  for (let i = 0; i < 20; i++) {
    if (rec(today).flow !== null || rec(P0).flow !== 'heavy' || rec(O).flow !== 'medium' || rec(S).flow !== 'spotting') leaks++;
  }
  check('no leaks between dates (20 rounds)', leaks === 0, leaks);

  console.log('TEST 9 - clearing flow keeps the period');
  await flow.saveFlow(P0, null);
  check(P0 + ' still a period day, flow not tracked', period.getPeriodInfo(P0).status === 'period' && rec(P0).flow === null, rec(P0));

  console.log('TEST 10 - adding flow keeps everything else');
  await svc.updateDailyRecord(P1, {
    mood: 'good', energy: 50, medications: ['iron'],
  });
  await require('../lib/sexualActivityService').saveSexualActivity(P1, 'none');
  await require('../lib/symptomService').saveSymptoms(P1, ['headache']);
  await period.markPeriodDay(P1);
  await flow.saveFlow(P1, 'medium');
  const r1 = rec(P1);
  check('mood, energy, symptoms, sexual activity, medications intact',
    r1.mood === 'good' && r1.energy === 50 && eq(r1.symptoms, ['headache']) && r1.sexualActivity && r1.sexualActivity.status === 'none' && eq(r1.medications, ['iron']) && r1.flow === 'medium', r1);

  console.log('PROTECTION - Daily Tracking Save never changes flow');
  check('saving a flow change through Daily Tracking is ignored', (await svc.updateDailyRecord(P1, { flow: 'heavy' })) === 'unchanged' && rec(P1).flow === 'medium', rec(P1));
  await svc.updateDailyRecord(P1, { mood: 'great' });
  check('saving mood keeps flow', rec(P1).flow === 'medium' && rec(P1).mood === 'great', rec(P1));

  console.log('TEST 11 / section 14 - spotting never changes period days or length');
  await period.markPeriodDay(P2);
  await flow.saveFlow(P2, 'light');
  check(P0 + ' is Period Day 1 (spotting on ' + S + ' is not Day 1)', period.getPeriodInfo(P0).dayNumber === 1, period.getPeriodInfo(P0));
  check(P2 + ' is Period Day 3', period.getPeriodInfo(P2).dayNumber === 3);
  check('period length = 3 recorded period days', period.getPeriodInfo(P2).episode.recordedDays === 3);

  console.log('FUTURE / VALIDATION');
  check('future date refused', (await flow.saveFlow(D(1), 'light')) === 'future');
  check('no record created for the future date', !store.getVivaState().dailyLogs[D(1)]);
  check('unknown value refused', (await flow.saveFlow(today, 'LIGHT')) === 'invalid');

  console.log('INSIGHTS DATA');
  check('flow counts', eq(flow.getFlowCounts(), { none: 0, spotting: 1, light: 1, medium: 2, heavy: 0 }), flow.getFlowCounts());
  check('spotting dates', eq(flow.getSpottingDates(), [S]), flow.getSpottingDates());
  const pattern = flow.getPeriodFlowPatterns();
  check('flow pattern across the period', pattern.length === 1 && eq(pattern[0].days.map((d) => d.flow), [null, 'medium', 'light']), pattern);
  const cycles = flow.getCycleFlowSummaries();
  check('flow per cycle (spotting before the period is outside it)', cycles.length === 1 && cycles[0].counts.medium === 2 && cycles[0].counts.light === 1 && cycles[0].counts.spotting === 0, cycles);

  console.log('CALENDAR');
  try {
    const cal = require('../constants/calendarModel');
    const dt = app.dates.keyToLocalDate(S);
    const cells = cal.buildCalendarMonth(dt.getFullYear(), dt.getMonth(), store.getVivaState().periods, null, [], today, app.pt.bleedingMarks(store.getVivaState().dailyLogs));
    const cell = (d) => cells.find((c) => c.dateKey === d);
    check('spotting day carries flow and is NOT a period day', cell(S) && cell(S).flow === 'spotting' && cell(S).isPeriod === false, cell(S));
    check('period day still a period day', cell(P1) && cell(P1).isPeriod === true && cell(P1).flow === 'medium', cell(P1));
  } catch (e) {
    check('calendar model loads', false, String(e));
  }

  console.log('TEST 8 - restart');
  app = freshApp();
  await app.store.loadVivaStore();
  ({ svc, period } = app);
  check('flow values survived', app.svc.readDailyRecord(S).flow === 'spotting' && app.svc.readDailyRecord(P1).flow === 'medium' && app.svc.readDailyRecord(P2).flow === 'light' && app.svc.readDailyRecord(O).flow === 'medium');
  check('period days survived', period.getPeriodInfo(P2).dayNumber === 3 && period.getPeriodInfo(S).status === 'untracked');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
