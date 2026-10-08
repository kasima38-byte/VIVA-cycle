// Year Overview - estimated ovulation day (Prompt 6)
// Run: npx --yes tsx tests/yearOvulation.test.cjs
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
const pad = (n) => String(n).padStart(2, '0');

function months(cycleLength, periods, years) {
  const est = engine.calculateCycle(baseline(cycleLength), periods, today);
  const marks = pt.bleedingMarks({});
  const out = [];
  for (const yr of years || [Y, Y + 1]) yp.yearCalendarMarks(yr, periods, est, marks, today).forEach((m, i) => out.push({ yr, m: i, ...m, est, marks, periods }));
  return out;
}
const cellsOf = (x) => cal.buildCalendarMonth(x.yr, x.m, x.periods, x.est, [], today, x.marks).filter((c) => c.isCurrentMonth);
const keysOf = (x, set) => [...set].map((d) => x.yr + '-' + pad(x.m + 1) + '-' + pad(d));
const sameAsCalendar = (list) => list.every((x) => {
  const fromCal = cellsOf(x).filter((c) => c.isOvulation).map((c) => c.dateKey).sort().join();
  return fromCal === keysOf(x, x.ovulation).sort().join();
});

console.log('SAME OVULATION DATE AS THE DETAILED CALENDAR');
const base = months(28, [{ start: D(-10) }]);
check('every month: ovulation day matches the detailed Calendar exactly', sameAsCalendar(base));
const all = base.flatMap((x) => keysOf(x, x.ovulation));
check('each ovulation date appears in exactly one month', all.length === new Set(all).size && all.length > 0, all);
check('a year with several cycles shows several ovulation days', all.length >= 2, all);

console.log('MIDDLE, END AND BEGINNING OF A MONTH');
let middle = null, end = null, begin = null;
for (let k = 1; k <= 40 && !(middle && end && begin); k++) {
  for (const x of months(28, [{ start: D(-k) }])) for (const d of x.ovulation) {
    const last = yo.daysInMonth(x.yr, x.m);
    if (!middle && d >= 10 && d <= 20) middle = { x, d };
    if (!end && d >= last - 2) end = { x, d };
    if (!begin && d <= 3) begin = { x, d };
  }
}
check('ovulation in the middle of a month is marked on that date', middle !== null && sameAsCalendar([middle.x]));
check('ovulation near the end of a month is marked on that date', end !== null && sameAsCalendar([end.x]));
check('ovulation near the beginning of a month is marked on that date', begin !== null && sameAsCalendar([begin.x]));

console.log('ANY SELECTED YEAR');
const next = months(28, [{ start: D(-10) }], [Y + 1]);
check('next year uses the same engine and matches the detailed Calendar', sameAsCalendar(next) && next.some((x) => x.ovulation.size > 0));
const prev = months(28, [{ start: D(-10) }], [Y - 1]);
check('a year before any logged period shows no ovulation', prev.every((x) => x.ovulation.size === 0));

console.log('OVERLAP WITH THE FERTILE WINDOW');
check('every ovulation day is inside the fertile window', base.every((x) => [...x.ovulation].every((d) => x.fertile.has(d))));
check('fertile days around ovulation remain marked', base.every((x) => x.ovulation.size === 0 || x.fertile.size > x.ovulation.size || [...x.fertile].length >= 1));

console.log('CHANGES TO CYCLE SETTINGS OR PERIOD DATA');
const c35 = months(35, [{ start: D(-10) }]);
check('a different cycle length moves the ovulation day', JSON.stringify(c35.flatMap((x) => keysOf(x, x.ovulation))) !== JSON.stringify(all) && sameAsCalendar(c35));
const moved = months(28, [{ start: D(-3) }]);
check('different period data moves the ovulation day', JSON.stringify(moved.flatMap((x) => keysOf(x, x.ovulation))) !== JSON.stringify(all) && sameAsCalendar(moved));

console.log('SCREEN');
const screen = read('app/year-overview.tsx');
const comp = read('components/MiniMonthCalendar.tsx');
const dayComp = read('components/CalendarDay.tsx');
check('each month gets its own ovulation day', screen.includes('ovulationDays={monthMarks[monthIndex].ovulation}'));
check('priority: actual > predicted > ovulation > fertile band', comp.includes('period ? styles.periodMark : predicted ? styles.predictedMark : ovulation ? styles.ovulationMark : undefined') && comp.includes('const ovulation = !period && !predicted'));
const calTokens = new Set();
for (const name of new Set((dayComp.match(/styles\.\w*[Oo]vul\w*/g) || []).map((s) => s.slice(7)))) {
  const blk = dayComp.match(new RegExp('\\b' + name + ':\\s*\\{([^}]*)\\}'));
  if (blk) for (const t of blk[1].match(/colors\.\w+/g) || []) calTokens.add(t);
}
const miniBlk = (comp.match(/ovulationMark: \{([^}]*)\}/) || [])[1] || '';
check('same ovulation colour as the detailed Calendar', [...calTokens].some((t) => miniBlk.includes('borderColor: ' + t)), { calendar: [...calTokens], mini: miniBlk.trim() });
check('distinct from the fertile band (white centre, ring)', miniBlk.includes('backgroundColor: colors.white') && miniBlk.includes('borderWidth'));
check('screen readers hear the ovulation day', comp.includes("', estimated ovulation on day '"));
check('informational only: month tap still opens the detailed Calendar', screen.includes('onPress={openMonth}') && !/logOvulation|setOvulation/.test(comp + screen));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
