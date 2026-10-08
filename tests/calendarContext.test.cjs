// Context-aware Calendar period tracking (Prompt 4)
// Run: npx --yes tsx tests/calendarContext.test.cjs
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
    engine: require('../lib/cycleEngine'),
    cal: require('../constants/calendarModel'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function load() { const a = freshApp(); await a.store.loadVivaStore(); await settle(); return a; }
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
  const cardOn = (t) => app.pl.calendarTrackingCard(app.pl.buildPeriodRecords(logs(), t), logs(), t);
  const md = (k) => SHORT[Number(k.slice(5, 7)) - 1] + ' ' + Number(k.slice(8, 10));

  console.log('NEVER LOGGED');
  check('one quiet line, no tracking card', JSON.stringify(cardOn(today)) === JSON.stringify({ kind: 'start', text: 'Log your period to start tracking.' }));

  console.log('SECTION 17 JOURNEY (Oct 7 -> 10, simulated day by day)');
  const [d7, d8, d9, d10] = [D(-3), D(-2), D(-1), today];
  app.store.logPeriod(d7); await settle();
  let c = cardOn(d7);
  check('Oct 7: Day 1 is an actual period day', app.period.getPeriodInfo(d7).status === 'period');
  check('Oct 7: first-time instruction', c.kind === 'tracking' && c.heading === 'Track your period' && c.text === 'Tap each day you have bleeding to record your period length.' && c.started === 'Started ' + md(d7) && c.logged === '1 bleeding day logged', c);
  await app.period.togglePeriodDay(d8);
  c = cardOn(d8);
  check('Oct 8: "2 bleeding days logged", today logged message', c.logged === '2 bleeding days logged' && c.heading === 'Period tracking' && c.text === 'Today is logged as a bleeding day.' && c.todayPrompt === null, c);
  await app.period.togglePeriodDay(d9);
  check('Oct 9: "3 bleeding days logged"', cardOn(d9).logged === '3 bleeding days logged');
  await app.period.togglePeriodDay(d10);
  check('Oct 10: "4 bleeding days logged"', cardOn(d10).logged === '4 bleeding days logged');
  app = await load();
  check('after leaving and returning: Oct 7-10 still actual', [d7, d8, d9, d10].every((d) => app.period.getPeriodInfo(d).status === 'period'));
  const v = app.pl.periodLengthView(app.pl.buildPeriodRecords(logs(), today), '12m', today);
  check('Insights: tracking in progress, no invented end or average', v.average === null && v.statusText === 'Tracking in progress' && v.notes[0] === 'Tracking in progress: 4 bleeding days logged so far', v);

  console.log('TODAY NOT YET LOGGED');
  c = cardOn(D(1));
  check('"Bleeding today? Tap today to record it." only when today is not logged', c.todayPrompt === 'Bleeding today? Tap today to record it.' && c.heading === 'Track your period' && c.text === 'Tap each day you have bleeding.', c);
  check('no prompt once today is logged', cardOn(today).todayPrompt === null);

  console.log('CARD DISAPPEARS WHEN THE PERIOD IS OVER');
  check('10 days after Day 1 -> normal clean Calendar', cardOn(D(7)) === null);

  console.log('SKIPPED DAY + HISTORICAL EDITING');
  memory.clear(); app = await load();
  const [a7, a8, a9, a10] = [D(-6), D(-5), D(-4), D(-3)];
  app.store.logPeriod(a7); await settle();
  await app.period.togglePeriodDay(a8);
  await app.period.togglePeriodDay(a10);
  check('skipped Oct 9 is never filled in', app.period.getPeriodInfo(a9).status === 'untracked');
  check('card counts what was logged (3), not 4', cardOn(today).logged === '3 bleeding days logged');
  let r = app.pl.buildPeriodRecords(logs(), today).pop();
  check('record marked incomplete (gap), not averaged', r.hasGap === true && r.countsForAverage === false && r.recordedDays === 2);
  await app.period.togglePeriodDay(a9);
  r = app.pl.buildPeriodRecords(logs(), today).pop();
  check('tapping the missed day later fixes it: 4 days, no gap', r.recordedDays === 4 && r.hasGap === false && cardOn(today).logged === '4 bleeding days logged');
  await app.period.togglePeriodDay(a8);
  r = app.pl.buildPeriodRecords(logs(), today).pop();
  check('removing a middle day splits it (Oct 7 | Oct 9-10), never "4 days"', r.recordedDays === 1 && r.hasGap === true && app.period.getPeriodInfo(a9).dayNumber === 1);

  console.log('PREVIOUS PERIODS STAY; PREDICTIONS STAY PREDICTIONS');
  memory.clear(); app = await load();
  app.store.logPeriod(D(-40)); await settle();
  for (let n = -39; n <= -37; n++) await app.period.togglePeriodDay(D(n));
  app.store.logPeriod(D(-5)); await settle();
  check('the earlier period is kept when a new one starts', app.period.getPeriodInfo(D(-38)).status === 'period' && app.pl.buildPeriodRecords(logs(), today).length === 2);
  check('the earlier period counts as completed (4 days)', app.pl.buildPeriodRecords(logs(), today)[0].countsForAverage && app.pl.buildPeriodRecords(logs(), today)[0].recordedDays === 4);
  const st = app.store.getVivaState();
  let est = null;
  try { est = app.engine.calculateCycle(st.baseline, st.periods, today); } catch (e) { est = null; }
  const dt = app.dates.keyToLocalDate(D(25));
  const cells = app.cal.buildCalendarMonth(dt.getFullYear(), dt.getMonth(), st.periods, est, [], today, app.pt.bleedingMarks(st.dailyLogs));
  check('no predicted day ever becomes an actual day', cells.filter((x) => x.isPredictedPeriod).every((x) => app.period.getPeriodInfo(x.dateKey).status !== 'period'));

  console.log('RETURNING USER WITH ONLY PAST DATA');
  memory.clear(); app = await load();
  app.store.logPeriod(D(-50)); await settle();
  await app.period.togglePeriodDay(D(-49));
  check('no instruction card - normal Calendar', cardOn(today) === null);

  console.log('SCREEN');
  const screen = fs.readFileSync(path.join(ROOT, 'app/(tabs)/calendar.tsx'), 'utf8');
  check('card shown only when relevant; taps always wired', screen.includes('{(card || tapMessage) && (') && screen.includes('onDayPress={(k) => void onDayPress(k)}'));
  check('no End Period button', !/End period/i.test(screen));

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
