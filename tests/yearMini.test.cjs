// Year Overview mini calendars (Prompt 2) - real dates, weekday alignment, one reusable component
// Run: npx --yes tsx tests/yearMini.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const yo = require('../lib/yearOverview');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}

// Independent weekday formula (Sakamoto) - 0 = Sunday. Does not use JavaScript dates.
function dow(y, m, d) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (m < 3) y -= 1;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7;
}
const mondayIndex = (y, m, d) => (dow(y, m, d) + 6) % 7; // 0 = Monday
const cellOf = (mm, day) => { const flat = mm.weeks.flat(); return flat.indexOf(day); };

console.log('2026 (the required year)');
const y = yo.buildYearOverview(2026);
check('Jan 1 2026 is a Thursday', cellOf(y[0], 1) === 3 && mondayIndex(2026, 1, 1) === 3);
check('Feb 1 2026 is a Sunday (last column), Feb 2026 has 28 days', cellOf(y[1], 1) === 6 && y[1].days === 28);
check('31-day month: January, March, May, July, August, October, December', [0, 2, 4, 6, 7, 9, 11].every((m) => y[m].days === 31));
check('30-day month: April, June, September, November', [3, 5, 8, 10].every((m) => y[m].days === 30));
check('every 2026 date sits on its real weekday', y.every((mm) => { for (let d = 1; d <= mm.days; d++) if (cellOf(mm, d) % 7 !== mondayIndex(2026, mm.monthIndex + 1, d)) return false; return true; }));

console.log('2028 (leap year)');
const L = yo.buildYearOverview(2028);
check('February 2028 has 29 days', L[1].days === 29);
check('Feb 29 2028 is a Tuesday', cellOf(L[1], 29) % 7 === 1 && mondayIndex(2028, 2, 29) === 1);
check('every 2028 date sits on its real weekday', L.every((mm) => { for (let d = 1; d <= mm.days; d++) if (cellOf(mm, d) % 7 !== mondayIndex(2028, mm.monthIndex + 1, d)) return false; return true; }));

console.log('EVERY MONTH 1900-2100');
const bad = [];
for (let yr = 1900; yr <= 2100; yr++) for (let m = 0; m < 12; m++) {
  const mm = yo.buildMiniMonth(yr, m);
  const expectDays = [31, (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
  const nums = mm.weeks.flat().filter((d) => d !== null);
  const ok = mm.days === expectDays && nums.length === expectDays && nums.every((d, i) => d === i + 1)
    && cellOf(mm, 1) === mondayIndex(yr, m + 1, 1) && mm.weeks.length === yo.MINI_WEEK_ROWS && mm.weeks.every((w) => w.length === 7)
    && mm.year === yr && mm.monthIndex === m;
  if (!ok) bad.push(yr + '-' + (m + 1));
}
check('2,412 months: right length, right day-1 weekday, 6 rows of 7, year + monthIndex kept', bad.length === 0, bad.slice(0, 5));

console.log('ARCHITECTURE');
const screen = read('app/year-overview.tsx');
const comp = read('components/MiniMonthCalendar.tsx');
check('one reusable component receives year + monthIndex and generates its month', comp.includes('buildMiniMonth(year, monthIndex)') && /year: number;\s*\n\s*monthIndex: number;/.test(comp));
check('the screen uses that same component for all 12 months (no per-month code)', (screen.match(/<MiniMonthCalendar/g) || []).length === 1 && screen.includes('MONTH_NAMES.map((_, monthIndex) =>') && screen.includes('monthIndex={monthIndex}'));
check('weekday header M T W T F S S', JSON.stringify(yo.WEEKDAY_INITIALS) === JSON.stringify(['M', 'T', 'W', 'T', 'F', 'S', 'S']) && comp.includes('WEEKDAY_INITIALS.map'));
check('no fertile / ovulation markers yet', !/isFertile|isOvulation/i.test(comp + screen));
const changed = execSync('git diff HEAD --name-only', { cwd: ROOT }).toString();
check('buildCalendarMonth / detailed calendar untouched', !changed.includes('constants/calendarModel.ts') && !changed.includes('components/CycleCalendar.tsx') && !changed.includes('components/CalendarDay.tsx'), changed);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
