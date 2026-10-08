// Year Overview -> detailed Calendar navigation (Prompt 7)
// Run: npx --yes tsx tests/yearNavigation.test.cjs
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const nav = require('../lib/calendarNavigation');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}

// A stand-in for the Calendar's own year/monthIndex state, wired exactly like calendar.tsx
const cal = { year: 2026, monthIndex: 9 };
const applyPickedMonth = () => { const p = nav.takePendingMonth(); if (p) { cal.year = p.year; cal.monthIndex = p.monthIndex; } };
const unsubscribe = nav.subscribePendingMonth(applyPickedMonth);

console.log('EVERY MONTH CARD, TWO YEARS');
for (const year of [2026, 2027]) {
  const wrong = [];
  for (let m = 0; m < 12; m++) {
    cal.year = year === 2026 ? 2030 : 2020; cal.monthIndex = (m + 5) % 12; // start somewhere else on purpose
    nav.setPendingMonth(year, m);
    applyPickedMonth(); // the focus backup runs too - must not change anything
    if (cal.year !== year || cal.monthIndex !== m) wrong.push(NAMES[m]);
  }
  check('Year Overview ' + year + ': all 12 cards open exactly their month', wrong.length === 0, wrong);
}
for (const m of [0, 1, 5, 8, 11]) {
  cal.year = 2026; cal.monthIndex = 9;
  nav.setPendingMonth(2026, m);
  check('tap ' + NAMES[m] + ' 2026 -> Calendar shows ' + NAMES[m] + ' 2026', cal.year === 2026 && cal.monthIndex === m, cal);
}

console.log('ONE-TIME HAND-OFF');
nav.setPendingMonth(2026, 3);
check('applied immediately, then cleared (no stale month later)', cal.monthIndex === 3 && nav.takePendingMonth() === null);
cal.monthIndex = 7;
applyPickedMonth();
check('a later focus never jumps back to an old pick', cal.monthIndex === 7);
nav.setPendingMonth(2026, 7);
check('tapping the same month again still works', cal.monthIndex === 7 && cal.year === 2026);
nav.setPendingMonth(2026, 12); nav.setPendingMonth(2026, -1); nav.setPendingMonth(99999, 3);
check('invalid month or year is ignored', cal.monthIndex === 7 && cal.year === 2026 && nav.takePendingMonth() === null);
unsubscribe();
nav.setPendingMonth(2028, 1);
check('if the Calendar was not mounted, the focus backup still gets it (once)', JSON.stringify(nav.takePendingMonth()) === JSON.stringify({ year: 2028, monthIndex: 1 }) && nav.takePendingMonth() === null);

console.log('PREVIOUS / NEXT AFTER ARRIVING (the Calendar\'s real code)');
const screen = read('app/(tabs)/calendar.tsx');
function arrow(name) {
  const m = screen.match(new RegExp('const ' + name + ' = \\(\\) => \\{([\\s\\S]*?)\\n  \\};'));
  return m ? m[1] : null;
}
const prevBody = arrow('goPrevMonth'), nextBody = arrow('goNextMonth');
check('found the Calendar\'s Previous and Next code', prevBody !== null && nextBody !== null);
function run(body, state) {
  const setMonthIndex = (v) => { state.monthIndex = typeof v === 'function' ? v(state.monthIndex) : v; };
  const setYear = (v) => { state.year = typeof v === 'function' ? v(state.year) : v; };
  new Function('monthIndex', 'year', 'setMonthIndex', 'setYear', body)(state.monthIndex, state.year, setMonthIndex, setYear);
  return state;
}
if (prevBody && nextBody) {
  const s = { year: 2026, monthIndex: 0 };
  nav.setPendingMonth(2026, 7); Object.assign(s, nav.takePendingMonth());
  check('1-3: tap August -> August 2026', s.year === 2026 && s.monthIndex === 7);
  run(nextBody, s);
  check('4-5: Next -> September 2026', s.year === 2026 && s.monthIndex === 8, s);
  run(prevBody, s);
  check('6-7: Previous -> August 2026', s.year === 2026 && s.monthIndex === 7, s);
  const dec = run(nextBody, { year: 2026, monthIndex: 11 });
  check('December 2026 -> Next -> January 2027', dec.year === 2027 && dec.monthIndex === 0, dec);
  const jan = run(prevBody, { year: 2026, monthIndex: 0 });
  check('January 2026 -> Previous -> December 2025', jan.year === 2025 && jan.monthIndex === 11, jan);
}

console.log('WIRING');
const yo = read('app/year-overview.tsx');
const mini = read('components/MiniMonthCalendar.tsx');
check('each card reports its own monthIndex', mini.includes('onPress ? () => onPress(monthIndex) : undefined') && yo.includes('monthIndex={monthIndex}'));
check('Year Overview passes the year it is showing + the tapped month, then closes', yo.includes('setPendingMonth(year, monthIndex);') && yo.includes('close();'));
check('Calendar applies it immediately (subscription) and on focus (backup)', screen.includes('useEffect(() => subscribePendingMonth(applyPickedMonth), [applyPickedMonth]);') && screen.includes('useFocusEffect(applyPickedMonth);'));
check('the Calendar only jumps to today when Today is pressed', (screen.match(/setMonthIndex\(todayDate\.getMonth\(\)\)/g) || []).length === 1);
check('arrows, Today and tapping days still wired', screen.includes('onPrevMonth={goPrevMonth}') && screen.includes('onNextMonth={goNextMonth}') && screen.includes('onToday={goToday}') && screen.includes('onDayPress={(k) => void onDayPress(k)}'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
