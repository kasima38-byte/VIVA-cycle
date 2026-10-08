// FINAL acceptance - period tracking workflow (Prompt 6)
// Run: npx --yes tsx tests/finalAcceptance.test.cjs
const fs = require('fs');
const path = require('path');
const memory = new Map();
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => { memory.set(k, v); },
  removeItem: async (k) => { memory.delete(k); },
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
    engine: require('../lib/cycleEngine'),
    cal: require('../constants/calendarModel'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function load() { const a = freshApp(); await a.store.loadVivaStore(); await settle(); return a; }
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  const logs = () => app.store.getVivaState().dailyLogs;
  const recs = (t) => app.pl.buildPeriodRecords(logs(), t || today);
  const cardOn = (t) => app.pl.calendarTrackingCard(recs(t), logs(), t);
  const md = (k) => SHORT[Number(k.slice(5, 7)) - 1] + ' ' + Number(k.slice(8, 10));
  const P1 = [D(-35), D(-34), D(-33), D(-32)];
  const P2 = [D(-7), D(-6), D(-5), D(-4), D(-3)];

  console.log('JOURNEY STEPS 1-6: LOG PERIOD -> DAY 1 -> INSTRUCTION');
  app.store.logPeriod(P1[0]); await settle();
  check('start date is an actual bleeding day (Day 1)', app.period.getPeriodInfo(P1[0]).status === 'period' && app.period.getPeriodInfo(P1[0]).dayNumber === 1);
  let c = cardOn(P1[0]);
  check('"Track your period" + full instruction + Started + 1 bleeding day logged', c.heading === 'Track your period' && c.text === 'Tap each day you have bleeding to record your period length.' && c.started === 'Started ' + md(P1[0]) && c.logged === '1 bleeding day logged', c);

  console.log('STEPS 7-9: TAP OCT 8, 9, 10');
  for (const d of P1.slice(1)) await app.period.togglePeriodDay(d);
  check('all four are actual period days', P1.every((d) => app.period.getPeriodInfo(d).status === 'period'));
  check('"4 bleeding days logged"', cardOn(P1[3]).logged === '4 bleeding days logged');
  const st = app.store.getVivaState();
  const dt = app.dates.keyToLocalDate(P1[0]);
  let est = null;
  try { est = app.engine.calculateCycle(st.baseline, st.periods, today); } catch (e) { est = null; }
  const cells = app.cal.buildCalendarMonth(dt.getFullYear(), dt.getMonth(), st.periods, est, [], today, app.pt.bleedingMarks(st.dailyLogs));
  check('Calendar draws them as actual period, never predicted', P1.every((d) => { const x = cells.find((k) => k.dateKey === d); return !x || (x.isPeriod && !x.isPredictedPeriod); }));

  console.log('STEPS 10-11: LEAVE AND RETURN');
  app = await load();
  check('all logged days remain after restart', P1.every((d) => app.period.getPeriodInfo(d).status === 'period'));

  console.log('STEPS 12-14: COMPLETED -> INSIGHTS "4 days"');
  check('period completes 10 days after Day 1 (never because the app was closed)', recs(D(-30))[0].status === 'active' && recs(D(-25))[0].status === 'completed');
  let v = app.pl.periodLengthView(recs(), '12m', today);
  check('Period Length: "4 days", "Based on 1 logged period", within range', v.averageText === '4 days' && v.notes.join('|').includes('Based on 1 logged period') && v.statusText === 'Within typical range', v);

  console.log('SECTION 12: OCT 7-10 THEN NOV 4-8');
  app.store.logPeriod(P2[0]); await settle();
  for (const d of P2.slice(1)) await app.period.togglePeriodDay(d);
  const r = recs();
  check('Period 1 = 4 days, Period 2 = 5 days, kept separate', r.length === 2 && r[0].periodLength === 4 && r[1].periodLength === 5);
  check('cycle length 28 from the two Day 1s (independent of period length)', app.ins.getCycleHistory()[0].cycleLength === 28);
  check('period 2 in progress: shown as tracking, not averaged yet', app.pl.periodLengthView(r, '12m', today).notes[0] === 'Tracking in progress: 5 bleeding days logged so far');
  const rows = app.pl.periodDetailRows(app.pl.periodLengthView(r, '12m', today));
  check('See Details lists each period, newest first, then the average', rows.length === 2 && rows[0].value === '5 days so far' && rows[1].value === '4 days');

  console.log('FILTERS');
  const keys = ['cycle', '3m', '6m', '12m'];
  check('every filter only uses its own window', keys.every((k) => app.pl.periodLengthView(r, k, today).inRange.every((p) => k === 'cycle' || p.start >= app.pl.monthsBefore(today, k === '3m' ? 3 : k === '6m' ? 6 : 12))));

  console.log('SECTION 9: DATA INTEGRITY RULES');
  check('ACTUAL != PREDICTED: no prediction stored as bleeding', Object.keys(logs()).every((d) => logs()[d].period !== 'yes' || [...P1, ...P2].includes(d)));
  check('MISSING != NO BLEEDING: untouched days stay untracked', app.period.getPeriodInfo(D(-20)).status === 'untracked');
  await app.period.togglePeriodDay(P2[2]);
  check('missing day after removal never invented; period marked incomplete', recs()[1].hasGap && recs()[1].periodLength === null);
  await app.period.togglePeriodDay(P2[2]);
  for (const d of P1.slice(1)) await app.period.togglePeriodDay(d);
  check('ZERO LOGGED DAYS != ZERO-DAY PERIOD: removing days never leaves 0', recs().every((p) => p.recordedDays > 0) && recs()[0].periodLength === 1);
  check('PERIOD LENGTH != CYCLE LENGTH: cycle still 28 after editing period 1', app.ins.getCycleHistory()[0].cycleLength === 28);
  for (const d of P1.slice(1)) await app.period.togglePeriodDay(d);
  check('no stale value: re-adding days restores 4 everywhere', recs()[0].periodLength === 4 && app.ins.getCycleHistory()[0].periodLength === 4);

  console.log('SECTION 18: NO TEMPORARY CODE');
  const screens = ['app/(tabs)/calendar.tsx', 'app/(tabs)/insights.tsx', 'lib/periodLength.ts', 'lib/periodService.ts', 'lib/periodTracking.ts'];
  check('no hard-coded dates in the period code', screens.every((f) => !/['"]20\d\d-\d\d-\d\d['"]/.test(read(f))));
  check('no mock data in the Calendar or Insights screens', !/mock|sampleData|fakeData/i.test(read('app/(tabs)/calendar.tsx') + read('app/(tabs)/insights.tsx')));
  check('DEV_TODAY is off', /const DEV_TODAY: DateStr \| null = null;/.test(read('lib/cycleEngine.ts')));
  check('no End Period button', !/End period/i.test(read('app/(tabs)/calendar.tsx')));

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
