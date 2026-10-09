// Year Overview - actual logged period days (Prompt 3)
// Run: npx --yes tsx tests/yearPeriods.test.cjs
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
    pt: require('../lib/periodTracking'),
    yp: require('../lib/yearPeriods'),
    cal: require('../constants/calendarModel'),
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
const days = (set) => [...set].sort((a, b) => a - b).join(',');

async function main() {
  memory.clear();
  let app = await load();
  const today = app.dates.getToday();
  const year = (y) => {
    const st = app.store.getVivaState();
    return app.yp.actualPeriodDaysByMonth(y, st.periods, app.pt.bleedingMarks(st.dailyLogs), today);
  };

  console.log('NO PERIOD RECORDS');
  check('a year with no records: every month plain', year(2026).every((s) => s.size === 0) && year(2024).every((s) => s.size === 0));

  console.log('LOG PERIODS');
  await app.period.savePeriodRange('2026-01-29', '2026-02-02');
  await app.period.savePeriodRange('2026-03-10', '2026-03-13');
  await app.period.savePeriodRange('2026-05-05', '2026-05-07');
  let y = year(2026);
  check('crossing period: January marks 29, 30, 31 only', days(y[0]) === '29,30,31', days(y[0]));
  check('crossing period: February marks 1, 2 only', days(y[1]) === '1,2', days(y[1]));
  check('period within one month: March marks 10-13 only', days(y[2]) === '10,11,12,13', days(y[2]));
  check('month with no period stays plain (April, June-December)', [3, 5, 6, 7, 8, 9, 10, 11].every((m) => y[m].size === 0));
  check('multiple periods across months: Jan, Feb, Mar and May all marked', [0, 1, 2, 4].every((m) => y[m].size > 0) && days(y[4]) === '5,6,7');
  check('other years untouched', year(2025).every((s) => s.size === 0) && year(2027).every((s) => s.size === 0));

  console.log('SAME SOURCE OF TRUTH AS THE DETAILED CALENDAR');
  const st = app.store.getVivaState();
  const mismatch = [];
  for (let m = 0; m < 12; m++) {
    const cells = app.cal.buildCalendarMonth(2026, m, st.periods, null, [], today, app.pt.bleedingMarks(st.dailyLogs));
    const fromCalendar = new Set(cells.filter((c) => c.isCurrentMonth && c.isPeriod).map((c) => Number(c.dateKey.slice(8, 10))));
    if (days(fromCalendar) !== days(y[m])) mismatch.push(m + 1);
  }
  check('every month marks exactly the days the detailed Calendar marks', mismatch.length === 0, mismatch);

  console.log('UPDATES WHEN PERIOD DATA CHANGES');
  await app.period.togglePeriodDay('2026-05-08');
  check('tapping a new bleeding day shows up', days(year(2026)[4]) === '5,6,7,8');
  await app.period.togglePeriodDay('2026-03-11');
  check('removing a day removes only that day', days(year(2026)[2]) === '10,12,13');
  app = await load();
  check('same after restart', days(year(2026)[2]) === '10,12,13' && days(year(2026)[0]) === '29,30,31');

  console.log('OLD START-ONLY / RANGE RECORDS');
  memory.clear();
  memory.set('viva-cycle:data', JSON.stringify({
    version: 1, setupComplete: true, name: 'T', dateOfBirth: null,
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null, reminders: {},
    periods: [{ start: '2026-06-28', end: '2026-07-02' }], dailyLogs: {},
  }));
  app = await load();
  y = year(2026);
  check('an older logged range is shown exactly as the detailed Calendar shows it', (() => {
    const s2 = app.store.getVivaState();
    return [5, 6].every((m) => {
      const cells = app.cal.buildCalendarMonth(2026, m, s2.periods, null, [], today, app.pt.bleedingMarks(s2.dailyLogs));
      return days(new Set(cells.filter((c) => c.isCurrentMonth && c.isPeriod).map((c) => Number(c.dateKey.slice(8, 10))))) === days(y[m]);
    });
  })());

  console.log('SCREEN');
  const screen = read('app/year-overview.tsx');
  const comp = read('components/MiniMonthCalendar.tsx');
  check('screen reads the same store and recalculates on change', screen.includes('useVivaStore()') && screen.includes('[year, viva.periods, est, marks, today]'));
  check('each month gets only its own days', screen.includes('periodDays={monthMarks[monthIndex].period}'));
  check('only the specific day numbers are styled (no whole-month dot)', comp.includes('periodDays.has(d)') && comp.includes('styles.periodMark'));
  check('same meaning as the detailed Calendar: solid magenta', /periodMark: \{[^}]*backgroundColor: colors\.magenta/.test(comp));
  check('screen readers hear the count, not just colour', comp.includes("' logged period days'"));
  check('no predictions passed in', read('lib/yearPeriods.ts').includes('NO_ESTIMATE'));

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
