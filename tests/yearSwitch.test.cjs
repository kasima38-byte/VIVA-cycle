// Year Overview - year navigation and edge cases (Prompt 9)
// Run: npx --yes tsx tests/yearSwitch.test.cjs
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
    yp: require('../lib/yearPeriods'),
    yo: require('../lib/yearOverview'),
    nav: require('../lib/calendarNavigation'),
    cal: require('../constants/calendarModel'),
    engine: require('../lib/cycleEngine'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function load() { const a = freshApp(); await a.store.loadVivaStore(); await settle(); return a; }
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const sorted = (set) => [...set].sort((a, b) => a - b).join(',');

async function main() {
  memory.clear();
  const app = await load();
  const today = app.dates.getToday();
  const thisYear = Number(today.slice(0, 4));
  await app.period.savePeriodRange('2025-12-30', '2026-01-02');
  app.store.logPeriod(app.dates.addDays(today, -10)); await settle();

  // Exactly what the screen computes for whichever year is selected
  const screenFor = (year) => {
    const st = app.store.getVivaState();
    const est = app.engine.calculateCycle(st.baseline, st.periods, today);
    return { year, st, est, months: app.yp.yearCalendarMarks(year, st.periods, est, app.pt.bleedingMarks(st.dailyLogs), today) };
  };
  const snapshot = (v) => v.months.map((m) => ['period', 'predicted', 'fertile', 'ovulation'].map((k) => sorted(m[k])).join('/')).join('|');

  console.log('1 / 2 - 2025 -> 2026 -> 2027');
  let year = 2025;
  const y2025 = screenFor(year);
  year = app.yo.stepYear(year, 1);
  const y2026 = screenFor(year);
  year = app.yo.stepYear(year, 1);
  const y2027 = screenFor(year);
  check('the arrows step one year at a time', y2026.year === 2026 && y2027.year === 2027);
  check('each year regenerates its own months (not a copy of the previous year)', snapshot(y2025) !== snapshot(y2026) && snapshot(y2026) !== snapshot(y2027));

  console.log('3 / 4 - ACROSS NEW YEAR');
  check('Dec 30-31 marked in December 2025 only', sorted(y2025.months[11].period) === '30,31' && sorted(y2026.months[11].period) !== '30,31');
  check('Jan 1-2 marked in January 2026 only', sorted(y2026.months[0].period) === '1,2' && y2025.months[0].period.size === 0);
  const sameAsCalendar = (v) => v.months.every((m, i) => {
    const cells = app.cal.buildCalendarMonth(v.year, i, v.st.periods, v.est, [], today, app.pt.bleedingMarks(v.st.dailyLogs)).filter((c) => c.isCurrentMonth);
    const pick = (f) => sorted(new Set(cells.filter(f).map((c) => Number(c.dateKey.slice(8, 10)))));
    const rightYear = cells.every((c) => Number(c.dateKey.slice(0, 4)) === v.year);
    return rightYear && pick((c) => c.isPeriod) === sorted(m.period) && pick((c) => c.isPredictedPeriod && !c.isPeriod) === sorted(m.predicted)
      && pick((c) => c.isFertile || c.isOvulation) === sorted(m.fertile) && pick((c) => c.isOvulation) === sorted(m.ovulation);
  });
  check('every year 2025-2028: all markings match the detailed Calendar and belong to that year', [2025, 2026, 2027, 2028].every((y) => sameAsCalendar(screenFor(y))));
  check('December 2026 -> January 2027 dates stay in their own years', sameAsCalendar(y2026) && sameAsCalendar(y2027));

  console.log('5 - LEAP YEARS');
  check('February 2026 = 28 days, February 2028 = 29 days', app.yo.buildMiniMonth(2026, 1).days === 28 && app.yo.buildMiniMonth(2028, 1).days === 29);

  console.log('6 - SWITCHING REPEATEDLY');
  let y = thisYear;
  for (const d of [1, 1, -1, -1, -1, 1, 1, -1]) y = app.yo.stepYear(y, d);
  check('back and forth ends on the right year', y === thisYear - 1 + 1 - 1 + 1, y);
  check('going back to a year shows exactly what it showed before', snapshot(screenFor(2026)) === snapshot(y2026) && snapshot(screenFor(2025)) === snapshot(y2025));
  check('year limits hold (1900-2200)', app.yo.stepYear(1900, -1) === 1900 && app.yo.stepYear(2200, 1) === 2200);

  console.log('7 - PICKING A MONTH AFTER SWITCHING YEARS');
  const calendarState = { year: thisYear, monthIndex: 0 };
  const unsub = app.nav.subscribePendingMonth(() => { const p = app.nav.takePendingMonth(); if (p) Object.assign(calendarState, p); });
  for (const [yr, m] of [[2027, 2], [2025, 11], [2028, 1]]) {
    app.nav.setPendingMonth(yr, m);
    check('viewing ' + yr + ', tap month ' + (m + 1) + ' -> Calendar opens ' + yr + '-' + (m + 1), calendarState.year === yr && calendarState.monthIndex === m, calendarState);
  }
  unsub();

  console.log('8 - RETURNING TO THE CURRENT YEAR');
  const screen = read('app/year-overview.tsx');
  check('"This year" button only when another year is shown; "Current year" caption otherwise', /isThisYear \? \(\s*<Text style=\{styles\.currentCaption\}>Current year<\/Text>\s*\) : \(\s*<Pressable\s+onPress=\{\(\) => setYear\(thisYear\)\}/.test(screen));
  check('this month is highlighted only in the current year', screen.includes('const currentMonth = isThisYear ? Number(today.slice(5, 7)) - 1 : -1;'));

  console.log('SCREEN WIRING');
  check('starts on the year the Calendar was showing', screen.includes('useState(() => parseYearParam(params.year, thisYear))'));
  check('arrows step the year (no hard-coded years)', screen.includes('setYear((y) => stepYear(y, -1))') && screen.includes('setYear((y) => stepYear(y, 1))') && !/['"]20\d\d['"]|\b20\d\d\b/.test(screen));
  check('all markings follow the selected year', screen.includes('[year, viva.periods, est, marks, today]'));
  check('a picked month carries the selected year', screen.includes('setPendingMonth(year, monthIndex);') && screen.includes('[year, close]'));
  check('arrows are big enough to tap and announce the year', screen.includes('minWidth: 44, minHeight: 44') && screen.includes("'Previous year, ' + (year - 1)"));

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
