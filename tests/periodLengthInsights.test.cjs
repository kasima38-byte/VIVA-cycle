// Period Length Insights from logged bleeding days
// Run: npx --yes tsx tests/periodLengthInsights.test.cjs
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
    data: require('../constants/insightsData'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function load() { const a = freshApp(); await a.store.loadVivaStore(); await settle(); return a; }

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}

async function main() {
  memory.clear();
  let app = await load();
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const view = (range) => app.pl.periodLengthView(app.pl.buildPeriodRecords(app.store.getVivaState().dailyLogs, today), range, today);
  const tap = async (from, to) => { for (let n = from; n <= to; n++) await app.period.togglePeriodDay(D(n)); };

  console.log('EMPTY');
  let v = view('12m');
  check('no data: dash, "No completed period data yet", Calendar instruction', v.averageText === '—' && v.statusText === 'No completed period data yet' && v.subtitle === 'Tap bleeding days on the Calendar to track your period length.' && v.withinRange === null);

  console.log('TEST 1 - LOG PERIOD START (active, not yet completed)');
  app.store.logPeriod(D(-1)); await settle();
  await app.period.togglePeriodDay(today);
  v = view('12m');
  check('current period shown as tracking in progress, not used for the average', v.average === null && v.statusText === 'Tracking in progress' && v.notes[0] === 'Tracking in progress: 2 bleeding days logged so far' && v.notes[1] === 'Complete your bleeding-day tracking to calculate period length.', v.notes);

  console.log('TEST 2 / 3 - FOUR DAYS, THEN COMPLETED');
  memory.clear(); app = await load();
  app.store.logPeriod(D(-100)); await settle();
  await tap(-99, -97);
  v = view('12m');
  check('4 logged days -> period length 4 days', v.average === 4 && v.averageText === '4 days' && v.counted[0].recordedDays === 4);
  check('one period: basis + "log more" wording', v.notes.join(' | ') === 'Based on 1 logged period. Log more periods to see your pattern.', v.notes);
  check('within typical range wording', v.withinRange === true && v.statusText === 'Within typical range');

  console.log('TEST 4 / 5 - MORE PERIODS');
  await tap(-72, -68);
  v = view('12m');
  check('4 and 5 -> average 4.5 days', v.average === 4.5 && v.averageText === '4.5 days' && v.notes.includes('Based on your last 2 periods'), v);
  await tap(-44, -42);
  v = view('12m');
  check('4, 5, 3 -> average 4 days, based on your last 3 periods', v.average === 4 && v.notes.includes('Based on your last 3 periods'));

  console.log('TEST 6 - FILTERS USE REAL TIME WINDOWS');
  check('3 Months: only the 2 periods that started in the last 3 months', view('3m').counted.length === 2);
  check('6 / 12 Months: all 3', view('6m').counted.length === 3 && view('12m').counted.length === 3);
  check('This Cycle: the current cycle\'s period only (3 days)', view('cycle').counted.length === 1 && view('cycle').average === 3);

  console.log('TEST 7 - DELETE A BLEEDING DAY');
  await app.period.togglePeriodDay(D(-68));
  v = view('12m');
  check('5-day period becomes 4; average updates to 3.7', v.counted.map((p) => p.recordedDays).join() === '4,4,3' && v.average === 3.7, v.counted.map((p) => p.recordedDays));

  console.log('TEST 8 - RESTART');
  app = await load();
  check('same results after restart', view('12m').average === 3.7 && view('3m').counted.length === 2);

  console.log('GAPS ARE NEVER FILLED IN');
  memory.clear(); app = await load();
  app.store.logPeriod(D(-30)); await settle();
  await tap(-29, -28);
  await app.period.togglePeriodDay(D(-26));
  check('Oct 7-9 + Oct 11 style gap -> never 5 days; marked incomplete, not averaged', view('12m').inRange[0].recordedDays === 3 && view('12m').inRange[0].hasGap === true && view('12m').counted.length === 0);

  console.log('WHEN A PERIOD COMPLETES');
  memory.clear(); app = await load();
  app.store.logPeriod(D(-2)); await settle();
  await app.period.togglePeriodDay(D(-1));
  check('last logged yesterday -> still current', view('12m').active !== null && view('12m').average === null);
  memory.clear(); app = await load();
  app.store.logPeriod(D(-3)); await settle();
  await app.period.togglePeriodDay(D(-2));
  check('a day not logged soon after Day 1 -> still in progress (never assumed over)', view('12m').active !== null && view('12m').average === null);
  await app.store.applyPeriodChanges({ [D(-1)]: 'no' });
  check('next day marked "no period" -> completed (2 days)', view('12m').active === null && view('12m').average === 2);
  memory.clear(); app = await load();
  app.store.logPeriod(D(-10)); await settle();
  await app.period.togglePeriodDay(D(-9));
  check('10 days after Day 1 -> completed (2 days)', view('12m').active === null && view('12m').average === 2);
  memory.clear(); app = await load();
  app.store.logPeriod(D(-1)); await settle();
  await app.period.togglePeriodDay(today);
  check('still bleeding today -> current', view('12m').active !== null);
  await app.store.applyPeriodChanges({ [D(1)]: 'no' });

  console.log('ONE-DAY PERIODS AND OLD START-ONLY RECORDS');
  memory.clear(); app = await load();
  app.store.logPeriod(D(-60)); await settle();
  v = view('12m');
  const rows = app.pl.periodDetailRows(v);
  check('shown in details, not invented into an average', v.average === null && rows[0].value === '1 day logged' && rows[0].note === 'Not included in the average (only 1 day logged)');

  console.log('RANGE WORDING (neutral)');
  check('8 days -> "Longer than the typical range"', app.pl.periodRangeStatus(8).text === 'Longer than the typical range' && app.pl.periodRangeStatus(8).within === false);
  check('1.5 days -> "Shorter than the typical range"', app.pl.periodRangeStatus(1.5).text === 'Shorter than the typical range');
  check('2 and 7 are within', app.pl.periodRangeStatus(2).within && app.pl.periodRangeStatus(7).within);
  check('months window clamps short months', app.pl.monthsBefore('2026-05-31', 3) === '2026-02-28' && app.pl.monthsBefore('2026-02-15', 3) === '2025-11-15');

  console.log('SCREEN');
  const screen = fs.readFileSync(path.join(ROOT, 'app/(tabs)/insights.tsx'), 'utf8');
  const card = fs.readFileSync(path.join(ROOT, 'components/ChartCard.tsx'), 'utf8');
  check('Period Length card fed from logged bleeding days, See Details wired', screen.includes('periodLengthView(periodsAll, range, today)') && screen.includes('onSeeDetails={() => setPeriodDetailsOpen(true)}'));
  check('old placeholder text gone', !screen.includes('Log when a period ends'));
  check('Cycle Length card unchanged', screen.includes('title="Cycle Length"') && screen.includes('withinRange={cycleAvg === null ? null : isWithin(cycleAvg, CYCLE_RANGE)}'));
  check('ChartCard defaults unchanged for other cards', card.includes("emptyText ?? 'No logged data yet'") && card.includes("statusText ?? (withinRange ? 'Within typical range' : 'Outside typical range')"));
  check('no medical wording', !/abnormal|diagnos|disorder/i.test(fs.readFileSync(path.join(ROOT, 'lib/periodLength.ts'), 'utf8')));

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
