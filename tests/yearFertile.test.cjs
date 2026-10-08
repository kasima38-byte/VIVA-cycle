// Year Overview - fertile window (Prompt 5)
// Run: npx --yes tsx tests/yearFertile.test.cjs
const fs = require('fs');
const path = require('path');
const asPath = require.resolve('@react-native-async-storage/async-storage');
const memory = new Map();
require.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null), setItem: async (k, v) => { memory.set(k, v); }, removeItem: async (k) => { memory.delete(k); },
} } };
console.warn = () => {};
const ROOT = path.join(__dirname, '..');
const yp = require('../lib/yearPeriods');
const yo = require('../lib/yearOverview');
const engine = require('../lib/cycleEngine');
const cal = require('../constants/calendarModel');
const pt = require('../lib/periodTracking');
const dates = require('../constants/dateUtils');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const today = dates.getToday();
const D = (n) => dates.addDays(today, n);
const Y = Number(today.slice(0, 4));
const baseline = (cycleLength) => ({ cycleLength, periodLength: 5, regularity: 'regular' });
const sorted = (set) => [...set].sort((a, b) => a - b).join();

function months(cycleLength, periods, dailyLogs) {
  const est = engine.calculateCycle(baseline(cycleLength), periods, today);
  const marks = pt.bleedingMarks(dailyLogs || {});
  const out = [];
  for (const yr of [Y, Y + 1]) yp.yearCalendarMarks(yr, periods, est, marks, today).forEach((m, i) => out.push({ yr, m: i, ...m, est, marks, periods }));
  return out;
}
const cellsOf = (x) => cal.buildCalendarMonth(x.yr, x.m, x.periods, x.est, [], today, x.marks).filter((c) => c.isCurrentMonth);
const day = (c) => Number(c.dateKey.slice(8, 10));
const sameAsCalendar = (list) => list.every((x) => sorted(new Set(cellsOf(x).filter((c) => c.isFertile || c.isOvulation).map(day))) === sorted(x.fertile));

console.log('SAME SOURCE OF TRUTH AS THE DETAILED CALENDAR');
const base = months(28, [{ start: D(-10) }]);
check('every month: fertile days match the detailed Calendar exactly', sameAsCalendar(base));
check('fertile windows exist (from the existing engine, nothing hard-coded)', base.some((x) => x.fertile.size > 0));
check('the estimated ovulation day is inside the window (no gap)', base.every((x) => cellsOf(x).filter((c) => c.isOvulation).every((c) => x.fertile.has(day(c)))));
check('no separate ovulation marker data', base.every((x) => Object.keys(x).every((k) => !/ovulation/i.test(k))));

console.log('WITHIN ONE MONTH AND ACROSS TWO MONTHS');
let crossing = null, within = null;
for (let k = 1; k <= 40 && !(crossing && within); k++) {
  const list = months(28, [{ start: D(-k) }]);
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    const last = yo.daysInMonth(a.yr, a.m);
    if (!crossing && a.fertile.has(last) && b.fertile.has(1)) crossing = { a, b, last };
    if (!within && a.fertile.size > 0 && !a.fertile.has(1) && !a.fertile.has(last)) within = a;
  }
}
check('a window entirely within one month is marked on its own days', within !== null && within.fertile.size > 0);
check('a window crossing two months is marked at the end of one AND the start of the next', crossing !== null);
check('crossing case matches the detailed Calendar in both months', crossing !== null && sameAsCalendar([crossing.a, crossing.b]));

console.log('ACTUAL PERIOD ON A FERTILE DAY');
const est0 = engine.calculateCycle(baseline(28), [{ start: D(-20) }], today);
const plain = months(28, [{ start: D(-20) }]);
let fertileDay = null;
for (const x of plain) for (const d of x.fertile) {
  const k = x.yr + '-' + String(x.m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  if (!fertileDay && k <= today) fertileDay = k;
}
if (fertileDay) {
  const withBleed = months(28, [{ start: D(-20) }], { [fertileDay]: { period: 'yes' } });
  const x = withBleed.find((m) => m.yr === Number(fertileDay.slice(0, 4)) && m.m === Number(fertileDay.slice(5, 7)) - 1);
  check('the logged period day is still an actual period day (the band never hides it)', x.period.has(Number(fertileDay.slice(8, 10))));
  check('still matches the detailed Calendar', sameAsCalendar(withBleed));
} else {
  check('found a past fertile day to test with', false, est0);
}

console.log('MONTHS WITHOUT A WINDOW + CYCLE LENGTHS');
const past = yp.yearCalendarMarks(Y - 1, [{ start: D(-10) }], engine.calculateCycle(baseline(28), [{ start: D(-10) }], today), pt.bleedingMarks({}), today);
check('months before the first logged period have no fertile days', past.every((x) => x.fertile.size === 0));
const c35 = months(35, [{ start: D(-10) }]);
check('28- and 35-day cycles give different fertile windows', JSON.stringify(base.map((x) => sorted(x.fertile))) !== JSON.stringify(c35.map((x) => sorted(x.fertile))));
check('35-day windows also match the detailed Calendar', sameAsCalendar(c35));

console.log('SCREEN');
const screen = read('app/year-overview.tsx');
const comp = read('components/MiniMonthCalendar.tsx');
const dayComp = read('components/CalendarDay.tsx');
check('each month gets its own fertile days', screen.includes('fertileDays={monthMarks[monthIndex].fertile}'));
check('band drawn behind the day, joined across neighbours', comp.includes('fertile && styles.fertileBand') && comp.includes('fertile && !joinLeft && styles.bandStart'));
check('period circles stay on top (actual > predicted > fertile)', comp.includes('period ? styles.periodMark : predicted ? styles.predictedMark : undefined'));
check('same colour as the detailed Calendar fertile window', comp.includes('backgroundColor: colors.lightPurple') && dayComp.includes('lightPurple'));
check('screen readers hear the fertile window count', comp.includes("' fertile window days'"));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
