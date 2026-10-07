// Period tracking - Prompt 2 cases, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/periodTracking.test.cjs
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
    pt: require('../lib/periodTracking'),
    dates: require('../constants/dateUtils'),
    insights: require('../constants/insightsData'),
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
  const X = D(-100), Y = D(-80);
  const A0 = D(-30), A1 = D(-29), A2 = D(-28), A3 = D(-27);
  const B0 = D(-60), B1 = D(-59), B2 = D(-58);

  // Saved data in the OLD format (version 1: start dates only)
  memory.set('viva-cycle:data', JSON.stringify({
    version: 1, setupComplete: true, name: 'Test', dateOfBirth: null,
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null,
    periods: [{ start: X }, { start: Y, end: D(-78) }],
    dailyLogs: { [X]: { date: X, mood: 'good', energy: 50 } }, reminders: {},
  }));

  let app = freshApp();
  await app.store.loadVivaStore();
  let { store, svc, period, pt } = app;
  const info = (d) => period.getPeriodInfo(d);
  const starts = () => store.getVivaState().periods.map((p) => p.start);

  console.log('MIGRATION - old saved periods become bleeding days');
  check('old start-only period -> 1 recorded day, mood kept', info(X).status === 'period' && store.getVivaState().dailyLogs[X].mood === 'good', store.getVivaState().dailyLogs[X]);
  check('old period with end -> each day recorded (Day 3 on its end)', info(D(-78)).dayNumber === 3, info(D(-78)));
  check('period starts unchanged', eq(starts(), [X, Y]), starts());

  console.log('CASE 1 - mark today');
  check('saved', (await period.markPeriodDay(today)) === 'saved');
  check('today = Period Day 1', info(today).status === 'period' && info(today).dayNumber === 1, info(today));

  console.log('CASE 2 - three consecutive days (other tracking already on the middle day)');
  await svc.updateDailyRecord(A1, { mood: 'good', energy: 50, symptoms: ['headache'] });
  for (const d of [A0, A1, A2]) check('mark ' + d, (await period.markPeriodDay(d)) === 'saved');
  check('Day 1, 2, 3', eq([A0, A1, A2].map((d) => info(d).dayNumber), [1, 2, 3]), [A0, A1, A2].map(info));
  check('"3 days recorded"', info(A1).episode.recordedDays === 3, info(A1).episode);

  console.log('CASE 3 - add another day later');
  check('mark ' + A3, (await period.markPeriodDay(A3)) === 'saved');
  check('it becomes Day 4; start date unchanged', info(A3).dayNumber === 4 && info(A3).episode.start === A0, info(A3));

  console.log('CASE 10a - marking periods kept the other tracking');
  let r = store.getVivaState().dailyLogs[A1];
  check('mood, energy, symptoms intact; flow untracked', r.mood === 'good' && r.energy === 50 && eq(r.symptoms, ['headache']) && r.flow === null, r);

  console.log('CASE 4 - remove a middle day');
  check('removed', (await period.removePeriodDay(A1)) === 'saved');
  check('removed day is UNTRACKED, not "no period"', info(A1).status === 'untracked', info(A1));
  check(A0 + ' is now a 1-day episode', info(A0).dayNumber === 1 && info(A0).episode.recordedDays === 1, info(A0));
  check(A2 + ' starts a new episode (Day 1), not Day 3', info(A2).dayNumber === 1, info(A2));
  r = store.getVivaState().dailyLogs[A1];
  check('CASE 10b - removing kept mood, energy, symptoms', r && r.mood === 'good' && r.energy === 50 && eq(r.symptoms, ['headache']), r);
  check('the gap does not create a new cycle', starts().includes(A0) && !starts().includes(A2), starts());

  console.log('CASE 5 - new period after a gap (date range)');
  check('range saved', (await period.savePeriodRange(B0, B2)) === 'saved');
  check('Day 1-3', eq([B0, B1, B2].map((d) => info(d).dayNumber), [1, 2, 3]));
  check('period starts are recalculated', eq(starts(), [X, Y, B0, A0, today]), starts());

  console.log('CASE 6 - edit that period to be one day shorter');
  check('edited', (await period.savePeriodRange(B0, B1, B1)) === 'saved');
  check('dropped day is untracked (no stale data)', info(B2).status === 'untracked', info(B2));
  check('"2 days recorded"', info(B0).episode.recordedDays === 2, info(B0).episode);

  console.log('VALIDATION');
  check('end before start refused', (await period.savePeriodRange(D(-5), D(-6))) === 'invalid');
  check('range into the future refused', (await period.savePeriodRange(D(-1), D(1))) === 'future');
  check('future day refused', (await period.markPeriodDay(D(1))) === 'future');
  check('no record created for the future day', !store.getVivaState().dailyLogs[D(1)]);
  check('range longer than 15 days refused', (await period.savePeriodRange(D(-40), D(-20))) === 'tooLong');
  check('saving the same period again changes nothing', (await period.markPeriodDay(A0)) === 'unchanged');

  console.log('PROTECTION - a Daily Tracking save never changes period days');
  await svc.updateDailyRecord(A2, { mood: 'great' });
  check(A2 + ' is still a period day after saving mood', info(A2).status === 'period' && store.getVivaState().dailyLogs[A2].mood === 'great');

  console.log('CASE 9 - period length data for Insights');
  const hist = period.getPeriodLengthHistory();
  check('history: recorded bleeding days per period', eq(hist.map((h) => h.recordedDays), [1, 3, 2, 1, 1]), hist);
  const stats = period.getPeriodLengthStats();
  check('stats skip 1-day records and the latest period', stats.count === 2 && stats.average === 2.5 && stats.shortest === 2 && stats.longest === 3 && stats.recent === 2, stats);
  const recs = app.insights.buildCycleRecords(store.getVivaState().periods, store.getVivaState().dailyLogs);
  check('Insights cycle records carry period length', eq(recs.map((x) => x.periodLength), [null, 3, 2, null]), recs.map((x) => x.periodLength));

  console.log('CASE 8 - calendar shows recorded bleeding days');
  try {
    const cal = require('../constants/calendarModel');
    const dt = app.dates.keyToLocalDate(A2);
    const cells = cal.buildCalendarMonth(dt.getFullYear(), dt.getMonth(), store.getVivaState().periods, null, [], today, pt.bleedingMarks(store.getVivaState().dailyLogs));
    const cell = (d) => cells.find((c) => c.dateKey === d);
    check(A2 + ' shown as period', cell(A2) && cell(A2).isPeriod === true, cell(A2));
    check(A1 + ' (removed) not shown as period', cell(A1) && cell(A1).isPeriod === false, cell(A1));
  } catch (e) {
    check('calendar model loads', false, String(e));
  }

  console.log('CASE 7 - restart the app');
  const before = { s: starts(), logs: store.getVivaState().dailyLogs };
  app = freshApp();
  await app.store.loadVivaStore();
  ({ store, period } = app);
  check('period days survived', eq([A0, A2, A3, B0, B1].map((d) => period.getPeriodInfo(d).dayNumber), [1, 1, 2, 1, 2]));
  check('period starts survived', eq(store.getVivaState().periods.map((p) => p.start), before.s));
  check('other tracking survived', store.getVivaState().dailyLogs[A1].mood === 'good' && store.getVivaState().dailyLogs[X].mood === 'good');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
