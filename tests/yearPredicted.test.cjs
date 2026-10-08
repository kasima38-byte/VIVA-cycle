// Year Overview - predicted period days (Prompt 4)
// Run: npx --yes tsx tests/yearPredicted.test.cjs
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

// 24 months (this year + next), each with its year/month and the marks the Year Overview shows
function months(cycleLength, periods, dailyLogs) {
  const est = engine.calculateCycle(baseline(cycleLength), periods, today);
  const marks = pt.bleedingMarks(dailyLogs || {});
  const out = [];
  for (const yr of [Y, Y + 1]) yp.yearCalendarMarks(yr, periods, est, marks, today).forEach((m, i) => out.push({ yr, m: i, ...m, est, marks, periods }));
  return out;
}
const sameAsCalendar = (list) => list.every((x) => {
  const cells = cal.buildCalendarMonth(x.yr, x.m, x.periods, x.est, [], today, x.marks).filter((c) => c.isCurrentMonth);
  const pred = cells.filter((c) => c.isPredictedPeriod && !c.isPeriod).map((c) => Number(c.dateKey.slice(8, 10))).sort((a, b) => a - b).join();
  const act = cells.filter((c) => c.isPeriod).map((c) => Number(c.dateKey.slice(8, 10))).sort((a, b) => a - b).join();
  return pred === [...x.predicted].sort((a, b) => a - b).join() && act === [...x.period].sort((a, b) => a - b).join();
});

console.log('SAME SOURCE OF TRUTH AS THE DETAILED CALENDAR');
const base = months(28, [{ start: D(-10) }]);
check('every month: predicted and actual days match the detailed Calendar exactly', sameAsCalendar(base));
check('predictions exist (computed from the existing engine, nothing hard-coded)', base.some((x) => x.predicted.size > 0));
check('no day is ever both actual and predicted', base.every((x) => [...x.predicted].every((d) => !x.period.has(d))));

console.log('WITHIN ONE MONTH AND ACROSS TWO MONTHS');
let crossing = null, within = null;
for (let k = 1; k <= 40 && !(crossing && within); k++) {
  const list = months(28, [{ start: D(-k) }]);
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    const last = yo.daysInMonth(a.yr, a.m);
    if (!crossing && a.predicted.has(last) && b.predicted.has(1)) crossing = { a, b, last };
    if (!within && a.predicted.size > 0 && !a.predicted.has(1) && !a.predicted.has(last)) within = a;
  }
}
check('a predicted period entirely within one month is marked on its own days', within !== null && [...within.predicted].every((d) => d > 1 && d < yo.daysInMonth(within.yr, within.m)));
check('a predicted period crossing two months is marked at the end of one AND the start of the next', crossing !== null && crossing.a.predicted.has(crossing.last) && crossing.b.predicted.has(1));
check('crossing case matches the detailed Calendar in both months', crossing !== null && sameAsCalendar([crossing.a, crossing.b]));

console.log('ACTUAL OVERLAPPING PREDICTED');
const overlap = months(28, [{ start: D(-1) }], { [today]: { period: 'yes' } });
const tm = overlap.find((x) => x.yr === Y && x.m === Number(today.slice(5, 7)) - 1);
const td = Number(today.slice(8, 10));
check('a logged bleeding day inside the predicted days shows as actual, not predicted', tm.period.has(td) && !tm.predicted.has(td));
check('still matches the detailed Calendar', sameAsCalendar(overlap));

console.log('MONTHS WITH NO PREDICTION');
const past = (() => { const est = engine.calculateCycle(baseline(28), [{ start: D(-10) }], today); return yp.yearCalendarMarks(Y - 1, [{ start: D(-10) }], est, pt.bleedingMarks({}), today); })();
const firstMonth = Number(D(-10).slice(5, 7)) - 1;
check('months before the first logged period have no predicted days', past.every((x) => x.predicted.size === 0));
check('a month without predicted days stays plain', base.some((x) => x.predicted.size === 0 && x.period.size === 0) || past.every((x) => x.predicted.size === 0 && x.period.size === 0));

console.log('DIFFERENT CYCLE LENGTHS + LIVE UPDATES');
const c28 = months(28, [{ start: D(-10) }]);
const c35 = months(35, [{ start: D(-10) }]);
const pad2 = (n) => String(n).padStart(2, '0');
// First predicted date AFTER today, searching every month (earlier months may only hold the current period)
const firstPred = (list) => {
  for (const x of list) {
    const future = [...x.predicted].sort((a, b) => a - b).map((d) => x.yr + '-' + pad2(x.m + 1) + '-' + pad2(d)).filter((k) => k > today);
    if (future.length) return future[0];
  }
  return null;
};
check('28- and 35-day cycles give different predictions', JSON.stringify(c28.map((x) => [...x.predicted])) !== JSON.stringify(c35.map((x) => [...x.predicted])));
check('the longer cycle predicts the next period later', firstPred(c35) !== null && firstPred(c28) !== null && firstPred(c35) > firstPred(c28), [firstPred(c28), firstPred(c35)]);
check('both still match the detailed Calendar', sameAsCalendar(c28) && sameAsCalendar(c35));
const moved = months(28, [{ start: D(-40) }, { start: D(-10) }]);
check('changing cycle data (a new logged period) moves the predictions', JSON.stringify(moved.map((x) => [...x.predicted])) !== JSON.stringify(months(28, [{ start: D(-40) }]).map((x) => [...x.predicted])));

console.log('SCREEN');
const screen = read('app/year-overview.tsx');
const comp = read('components/MiniMonthCalendar.tsx');
check('same estimate as the Calendar, recalculated when cycle data changes', screen.includes('calculateCycle(viva.baseline, viva.periods, today)') && screen.includes('[viva.baseline, viva.periods, today]'));
check('each month gets its own predicted days', screen.includes('predictedDays={monthMarks[monthIndex].predicted}'));
check('only the specific day numbers are styled; actual wins', comp.includes('!period && d !== null && predictedDays.has(d)') && comp.includes('styles.predictedMark'));
check('predicted look = light pink + outline (distinct from solid actual)', /predictedMark: \{[^}]*backgroundColor: colors\.pinkSoft[^}]*borderColor: colors\.magenta/.test(comp));
check('no fertile window / ovulation yet', !/isFertile|isOvulation/.test(screen + comp + read('lib/yearPeriods.ts')));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
