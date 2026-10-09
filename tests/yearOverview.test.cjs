// Year Overview (Prompt 1) - real calendar logic + navigation wiring
// Run: npx --yes tsx tests/yearOverview.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
const path = require('path');
const asPath = require.resolve('@react-native-async-storage/async-storage');
const memory = new Map();
require.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null), setItem: async (k, v) => { memory.set(k, v); }, removeItem: async (k) => { memory.delete(k); }, getAllKeys: async () => [...memory.keys()],
} } };
console.warn = () => {};
const ROOT = path.join(__dirname, '..');
const yo = require('../lib/yearOverview');
const nav = require('../lib/calendarNavigation');
const cal = require('../constants/calendarModel');
const pt = require('../lib/periodTracking');
const dates = require('../constants/dateUtils');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}

console.log('MONTHS AND DATES');
const y2026 = yo.buildYearOverview(2026);
check('12 months, January to December', y2026.length === 12 && y2026[0].name === 'January' && y2026[11].name === 'December');
check('month lengths 2026', JSON.stringify(y2026.map((m) => m.days)) === JSON.stringify([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]));
check('February: 2024 = 29, 2026 = 28, 2000 = 29, 1900 = 28, 2100 = 28', [2024, 2026, 2000, 1900, 2100].map((y) => yo.buildYearOverview(y)[1].days).join() === '29,28,29,28,28');
check('leap-year rule', yo.isLeapYear(2024) && !yo.isLeapYear(2026) && yo.isLeapYear(2000) && !yo.isLeapYear(1900));
check('every month lists 1..last day exactly once, in rows of 7', y2026.every((m) => {
  const nums = m.weeks.flat().filter((d) => d !== null);
  return m.weeks.every((w) => w.length === 7) && nums.length === m.days && nums.every((d, i) => d === i + 1);
}));
check('Oct 1 2026 is a Thursday (3 blanks in a Monday-first week)', yo.mondayLead(2026, 9) === 3 && y2026[9].weeks[0].slice(0, 4).join() === ',,,1');

console.log('MATCHES THE DETAILED CALENDAR');
const today = dates.getToday();
let mismatches = [];
for (let y = 2024; y <= 2028; y++) for (let m = 0; m < 12; m++) {
  const cells = cal.buildCalendarMonth(y, m, [], null, [], today, pt.bleedingMarks({}));
  const lead = cells.findIndex((c) => c.isCurrentMonth);
  if (lead !== yo.mondayLead(y, m)) mismatches.push(y + '-' + (m + 1));
}
check('same Monday-first layout as the Calendar for every month 2024-2028', mismatches.length === 0, mismatches);

console.log('YEAR PARAMETER');
check('reads the selected year', yo.parseYearParam('2027', 2026) === 2027 && yo.parseYearParam(['2025'], 2026) === 2025);
check('missing or invalid year falls back safely', yo.parseYearParam(undefined, 2026) === 2026 && yo.parseYearParam('abc', 2026) === 2026 && yo.parseYearParam('99999', 2026) === 2026);

console.log('NAVIGATION HAND-OFF');
nav.setPendingMonth(2027, 4);
const picked = nav.takePendingMonth();
check('picked month reaches the Calendar once, then clears', picked.year === 2027 && picked.monthIndex === 4 && nav.takePendingMonth() === null);

console.log('WIRING');
const screen = read('app/year-overview.tsx');
const calScreen = read('app/(tabs)/calendar.tsx');
const selector = read('components/MonthSelector.tsx');
check('month pill opens the Year Overview for the shown year', calScreen.includes("onLabelPress={() => router.push(('/year-overview?year=' + year) as Href)}") && selector.includes('onPress={onLabelPress}'));
check('pill stays a plain label on screens that do not ask for it', selector.includes('disabled={!onLabelPress}'));
check('back control and month cards return to the Calendar', screen.includes('accessibilityLabel="Back to calendar"') && screen.includes('setPendingMonth(year, monthIndex)') && calScreen.includes('takePendingMonth()'));
check('months generated from date logic (no hard-coded dates)', read('components/MiniMonthCalendar.tsx').includes('buildMiniMonth(year, monthIndex)') && !/['"]20\d\d-\d\d-\d\d['"]/.test(screen + read('lib/yearOverview.ts')));
check('no fertile / ovulation markers yet', !/isFertile|isOvulation/i.test(screen + read('lib/yearOverview.ts')));
check('the detailed calendar arrows and Today are unchanged', calScreen.includes('onPrevMonth={goPrevMonth}') && calScreen.includes('onNextMonth={goNextMonth}') && calScreen.includes('onToday={goToday}'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
