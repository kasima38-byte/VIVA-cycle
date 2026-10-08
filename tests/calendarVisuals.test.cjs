// Calendar visual states for logged bleeding days (data + drawing rules; the look needs the phone)
// Run: npx --yes tsx tests/calendarVisuals.test.cjs
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
  const st = () => app.store.getVivaState();
  const month = (dateKey) => {
    const dt = app.dates.keyToLocalDate(dateKey);
    let est = null;
    try { est = app.engine.calculateCycle(st().baseline, st().periods, today); } catch (e) { est = null; }
    return app.cal.buildCalendarMonth(dt.getFullYear(), dt.getMonth(), st().periods, est, [], today, app.pt.bleedingMarks(st().dailyLogs));
  };
  const cell = (d) => month(d).find((c) => c.dateKey === d);
  const lines = () => app.pt.periodPreviewLines(app.pt.latestPeriodSummary(st().dailyLogs));
  const S = D(-12), S1 = D(-11), S2 = D(-10), S8 = D(-4);

  console.log('A - LOG PERIOD START');
  app.store.logPeriod(S); await settle();
  check('start day is an actual period day and marked as the start', cell(S).isPeriod && cell(S).isPeriodStart && cell(S).isPredictedPeriod === false);
  const startText = 'Period started ' + SHORT[Number(S.slice(5, 7)) - 1] + ' ' + Number(S.slice(8, 10));
  check('J - one day reported as 1 (not 0), singular', JSON.stringify(lines()) === JSON.stringify([startText, '1 bleeding day logged']), lines());

  console.log('B / C - TAP THE NEXT DAYS');
  await app.period.togglePeriodDay(S1);
  await app.period.togglePeriodDay(S2);
  check('three actual period days, only the first is the start', [S, S1, S2].every((d) => cell(d).isPeriod) && cell(S).isPeriodStart && cell(S1).isPeriodStart === false && cell(S2).isPeriodStart === false);
  check('preview counts logged bleeding days (plural)', lines()[1] === '3 bleeding days logged', lines());

  console.log('D - TAP AGAIN TO REMOVE');
  await app.period.togglePeriodDay(S2);
  check('removed immediately, preview updates', cell(S2).isPeriod === false && lines()[1] === '2 bleeding days logged', lines());
  await app.period.togglePeriodDay(S2);

  console.log('NON-CONSECUTIVE DAYS ARE A SEPARATE RUN');
  await app.period.togglePeriodDay(S8);
  check('a later separate day starts its own run (never "day 4")', cell(S8).isPeriod && cell(S8).isPeriodStart && app.period.getPeriodInfo(S8).dayNumber === 1 && app.period.getPeriodInfo(S2).episode.recordedDays === 3);
  check('the period length stays 3 (the separate run is not added to it)', lines()[1] === '3 bleeding days logged', lines());

  console.log('I - ACTUAL BEATS PREDICTED');
  const all = month(S).concat(month(D(30)));
  check('no logged bleeding day is drawn as predicted', all.filter((c) => c.isPeriod).every((c) => c.isPredictedPeriod === false));
  check('predicted days are never counted as bleeding', all.filter((c) => c.isPredictedPeriod).every((c) => app.period.getPeriodInfo(c.dateKey).status !== 'period'));

  console.log('E / F / G - LEAVE, CHANGE MONTH, RESTART');
  month(app.dates.addDays(S, -35)); month(D(40));
  check('markings unchanged after visiting other months', [S, S1, S2, S8].every((d) => cell(d).isPeriod));
  app = await load();
  check('markings and preview survive a restart', [S, S1, S2, S8].every((d) => cell(d).isPeriod) && lines()[1] === '3 bleeding days logged');

  console.log('H - TODAY IS A BLEEDING DAY');
  memory.clear();
  app = await load();
  app.store.logPeriod(D(-2)); await settle();
  await app.period.togglePeriodDay(D(-1));
  await app.period.togglePeriodDay(today);
  const t = cell(today);
  check('today keeps both states (today + actual period)', t.isToday && t.isPeriod && t.isPeriodStart === false);

  console.log('DRAWING RULES');
  const day = fs.readFileSync(path.join(ROOT, 'components/CalendarDay.tsx'), 'utf8');
  const grid = fs.readFileSync(path.join(ROOT, 'components/CycleCalendar.tsx'), 'utf8');
  check('consecutive days are joined across the whole month (incl. week rows)', grid.includes('periodJoinLeft={!!day.isPeriod && !!days[w * 7 + i - 1]?.isPeriod}') && grid.includes('periodJoinRight={!!day.isPeriod && !!days[w * 7 + i + 1]?.isPeriod}'));
  check('connecting strip sits behind the circles (soft pink)', day.includes("join: { position: 'absolute'") && day.includes('backgroundColor: colors.pinkSoft }'));
  check('today ring on period days; "Today" label kept', day.includes('day.isPeriod && day.isToday && styles.todayOnPeriod') && day.includes('>Today<'));
  check('period start: subtle bar + spoken "period start"', day.includes('styles.startBar') && day.includes("'period start'"));
  check('actual period drawn first (before ovulation and predicted)', day.indexOf('if (day.isPeriod)') < day.indexOf('day.isOvulation') && day.indexOf('if (day.isPeriod)') < day.indexOf('} else if (day.isPredictedPeriod)'));

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
