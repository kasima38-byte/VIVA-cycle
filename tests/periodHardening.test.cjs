// Period tracking hardening - Prompt 5 test matrix
// Run: npx --yes tsx tests/periodHardening.test.cjs
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
console.warn = () => {};

const ROOT = path.join(__dirname, '..');
function freshApp() {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(path.join(ROOT, 'lib')) || k.startsWith(path.join(ROOT, 'constants'))) delete require.cache[k];
  }
  return {
    store: require('../lib/vivaStore'),
    period: require('../lib/periodService'),
    pl: require('../lib/periodLength'),
    pt: require('../lib/periodTracking'),
    ins: require('../lib/insightsService'),
    data: require('../constants/insightsData'),
    engine: require('../lib/cycleEngine'),
    cal: require('../constants/calendarModel'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function load() { const a = freshApp(); await a.store.loadVivaStore(); await settle(); return a; }
async function fresh() { memory.clear(); return load(); }

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  let app = await fresh();
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const logs = () => app.store.getVivaState().dailyLogs;
  const recs = () => app.pl.buildPeriodRecords(logs(), today);
  const rec = (start) => recs().find((r) => r.start === start);
  const tap = (d) => app.period.togglePeriodDay(d);

  console.log('A / B / C - 1, 2, 4 DAYS');
  app.store.logPeriod(D(-30)); await settle();
  check('A: Oct 7 only -> periodLength 1 (stored, not rejected)', rec(D(-30)).periodLength === 1);
  await tap(D(-29));
  check('B: Oct 7-8 -> 2', rec(D(-30)).periodLength === 2);
  await tap(D(-28)); await tap(D(-27));
  check('C: Oct 7-10 -> 4', rec(D(-30)).periodLength === 4);

  console.log('D - REMOVE A MIDDLE DAY');
  await tap(D(-28));
  check('D: Oct 7-8 + Oct 10 is never a continuous 4-day period', rec(D(-30)).periodLength === null && rec(D(-30)).hasGap && rec(D(-30)).countsForAverage === false && rec(D(-30)).loggedInWindow === 3);
  check('the missing day stays unknown (never invented)', app.period.getPeriodInfo(D(-28)).status === 'untracked');
  await tap(D(-28));
  check('re-adding it later restores Oct 7-10 = 4', rec(D(-30)).periodLength === 4 && rec(D(-30)).hasGap === false);

  console.log('E - SEPARATE BLEEDING LATER IN THE SAME CYCLE');
  await tap(D(-17)); await tap(D(-16));
  check('E: Oct 20-21 is its own episode, never merged', app.period.getPeriodInfo(D(-17)).dayNumber === 1 && rec(D(-30)).periodLength === 4);
  check('and not counted as a new period (too close to be a new cycle)', recs().length === 1);

  console.log('9 - REMOVE THE FIRST DAY');
  app = await fresh();
  await app.period.savePeriodRange(D(-20), D(-18));
  await tap(D(-20));
  check('the period now starts on the next logged day; no stale start date', recs()[0].start === D(-19) && recs()[0].periodLength === 2 && app.store.getVivaState().periods.every((p) => p.start !== D(-20)));

  console.log('F - YEAR BOUNDARY');
  app = await fresh();
  await app.period.savePeriodRange('2025-12-29', '2026-01-02');
  check('F: Dec 29 - Jan 2 -> 5 days', rec('2025-12-29').periodLength === 5);

  console.log('G / 12 - LONG PERIODS ARE NEVER TRUNCATED');
  app = await fresh();
  await app.period.savePeriodRange(D(-80), D(-69));
  await app.period.savePeriodRange(D(-40), D(-32));
  check('G: 9-day period = 9', rec(D(-40)).periodLength === 9);
  check('12-day period = 12 (not 7, not 10)', rec(D(-80)).periodLength === 12);
  const v12 = app.pl.periodLengthView(recs(), '12m', today);
  check('interpretation only: "Longer than the typical range", data untouched', v12.average === 10.5 && v12.statusText === 'Longer than the typical range');

  console.log('H - DELETE ALL BLEEDING DAYS OF A PERIOD');
  for (let n = -40; n <= -32; n++) await tap(D(n));
  check('H: the period disappears, no 0-day period anywhere', recs().length === 1 && recs().every((r) => r.periodLength !== 0 && r.recordedDays > 0));
  check('Insights never show 0 days', app.pl.periodLengthView(recs(), '12m', today).chart.every((c) => c.value > 0));

  console.log('I / 6 - EXISTING PERIOD + NEW PERIOD');
  app.store.logPeriod(D(-10)); await settle();
  check('I: both periods kept', recs().length === 2 && rec(D(-80)).periodLength === 12 && rec(D(-10)) !== undefined);

  console.log('J / 7 / 14 - DUPLICATES AND OVERLAPS');
  const before = JSON.stringify(logs());
  check('J: same start logged twice is refused', app.store.logPeriod(D(-10)).kind === 'duplicate');
  check('a start inside an existing period is refused, not overwritten', app.store.logPeriod(D(-9)).kind === 'tooClose');
  await settle();
  check('no duplicate or changed records', JSON.stringify(logs()) === before && recs().length === 2);

  console.log('15 - FUTURE DATES');
  check('tap on a future date refused', (await tap(D(2))).result === 'future');
  check('Log Period on a future date refused', app.store.logPeriod(D(2)).kind === 'future');
  check('nothing stored for the future', logs()[D(2)] === undefined);

  console.log('K / 2 - PREDICTIONS STAY PREDICTIONS');
  const st = app.store.getVivaState();
  let est = null;
  try { est = app.engine.calculateCycle(st.baseline, st.periods, today); } catch (e) { est = null; }
  const dt = app.dates.keyToLocalDate(D(20));
  const cells = app.cal.buildCalendarMonth(dt.getFullYear(), dt.getMonth(), st.periods, est, [], today, app.pt.bleedingMarks(st.dailyLogs));
  check('K: no predicted day is ever stored or counted as bleeding', cells.filter((c) => c.isPredictedPeriod).every((c) => logs()[c.dateKey] === undefined || logs()[c.dateKey].period !== 'yes'));

  console.log('1 / 13 - PERIOD LENGTH vs CYCLE LENGTH');
  app = await fresh();
  await app.period.savePeriodRange(D(-60), D(-56));
  await app.period.savePeriodRange(D(-32), D(-28));
  const h = app.ins.getCycleHistory();
  check('period lengths 5 and 5, cycle length 28', h[0].periodLength === 5 && h[0].cycleLength === 28 && rec(D(-32)).periodLength === 5);
  await app.period.savePeriodRange(D(-32), D(-30), D(-31));
  check('changing a period length never changes cycle length', app.ins.getCycleHistory()[0].cycleLength === 28 && rec(D(-32)).periodLength === 3);

  console.log('21 - ONE CALCULATION PATH');
  app = await fresh();
  await app.period.savePeriodRange(D(-60), D(-57));
  app.store.logPeriod(D(-32)); await settle();
  const fromRecords = rec(D(-60)).periodLength;
  const fromInsightsLayer = app.ins.getCycleHistory()[0].periodLength;
  const fromCycleData = app.data.buildCycleRecords(app.store.getVivaState().periods, logs())[0].periodLength;
  const fromPeriodScreen = app.period.getPeriodInfo(D(-60)).episode.recordedDays;
  check('Calendar, Period Length card, Insights layer and cycle data all say 4', [fromRecords, fromInsightsLayer, fromCycleData, fromPeriodScreen].every((x) => x === 4), [fromRecords, fromInsightsLayer, fromCycleData, fromPeriodScreen]);

  console.log('M - INSIGHTS RANGES STAY CONSISTENT');
  app = await fresh();
  for (const [s, n] of [[-330, 4], [-200, 5], [-120, 3], [-60, 6], [-30, 4]]) await app.period.savePeriodRange(D(s), D(s + n - 1));
  const views = ['cycle', '3m', '6m', '12m'].map((r) => app.pl.periodLengthView(recs(), r, today));
  const starts = (v) => v.counted.map((p) => p.start);
  check('3 Months within 6 Months within 12 Months', starts(views[1]).every((s) => starts(views[2]).includes(s)) && starts(views[2]).every((s) => starts(views[3]).includes(s)));
  check('each average is exactly the mean of its own periods', views.every((v) => v.average === null || v.average === Math.round(v.counted.reduce((s, p) => s + p.recordedDays, 0) / v.counted.length * 10) / 10));
  check('This Cycle = the latest period only', views[0].inRange.length === 1 && views[0].inRange[0].start === D(-30));

  console.log('L - RESTART');
  const snapshot = JSON.stringify(recs());
  app = await load();
  check('L: all bleeding data and period records identical after restart', JSON.stringify(recs()) === snapshot);

  console.log('19 / 20 - EXISTING USERS AND MIGRATION');
  memory.clear();
  const X = D(-100), Y = D(-60);
  memory.set('viva-cycle:data', JSON.stringify({
    version: 1, setupComplete: true, name: 'T', dateOfBirth: null,
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null, reminders: {},
    periods: [{ start: X }, { start: Y }], dailyLogs: {},
  }));
  app = await load();
  check('old start dates kept as 1 logged day each - no invented lengths', recs().length === 2 && recs().every((r) => r.recordedDays === 1));
  check('Insights explain more tracking is needed (no fake average)', app.pl.periodLengthView(recs(), '12m', today).average === null && app.pl.periodLengthView(recs(), '12m', today).statusText === 'No completed period data yet');
  const once = JSON.stringify(logs());
  app = await load();
  app = await load();
  check('migration is idempotent (loading again never duplicates)', JSON.stringify(logs()) === once && recs().length === 2);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
